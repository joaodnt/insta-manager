require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
// Image generation via direct REST — gemini-2.5-flash-image (Nano Banana)
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Serve uploaded images ────────────────────────────────
const fs = require('fs');
const IMAGES_DIR = path.join(__dirname, '..', 'data', 'images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
app.use('/images', express.static(IMAGES_DIR));

// ── Posts CRUD ───────────────────────────────────────────
app.get('/api/posts', (req, res) => {
  const { status, pilar, formato } = req.query;
  res.json(db.findPosts({ status, pilar, formato }));
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

app.post('/api/posts', (req, res) => {
  const { hook, caption, corpo, cta, pilar, formato, status, scheduled_date, image_url, image_prompt, video_url, hashtags, notes, slides } = req.body;
  if (!pilar || !formato) return res.status(400).json({ error: 'pilar e formato são obrigatórios' });
  const post = db.insert({ hook: hook || '', caption: caption || '', corpo: corpo || '', cta: cta || '', pilar, formato, status: status || 'rascunho', scheduled_date: scheduled_date || null, image_url: image_url || null, image_prompt: image_prompt || '', video_url: video_url || null, hashtags: hashtags || '', notes: notes || '', slides: slides || [] });
  res.status(201).json(post);
});

app.put('/api/posts/:id', (req, res) => {
  const post = db.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const fields = ['hook','caption','corpo','cta','pilar','formato','status','scheduled_date','image_url','image_prompt','hashtags','notes','video_url','slides'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  res.json(db.update(req.params.id, updates));
});

app.delete('/api/posts/:id', (req, res) => {
  if (!db.remove(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Bulk delete
app.post('/api/posts/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids obrigatorio' });
  let deleted = 0;
  for (const id of ids) {
    if (db.remove(id)) deleted++;
  }
  res.json({ ok: true, deleted });
});

// ── Stats ─────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json(db.stats());
});

// ── Image generation (Imagen 4.0 → fallback Nano Banana) ──
app.post('/api/generate-image', async (req, res) => {
  const { prompt, postId, aspectRatio = '9:16' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt obrigatório' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY não configurada.' });

  const enhancedPrompt = `Imagem para post de Instagram da marca Infomestre (criador de cursos digitais brasileiro). Cores da marca: fundo preto escuro (#0A0A0A), destaque verde limão neon (#CCFF00), tipografia branca em negrito. Estilo moderno, minimalista e ousado. ${prompt}. Alta qualidade, fotorrealista ou ilustração. Sem marcas d'água. Sem texto na imagem. Contexto brasileiro.`;

  // Try Imagen 4.0 first (predict endpoint)
  try {
    console.log('Trying imagen-4.0-generate-001...');
    const imagenRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: enhancedPrompt }],
          parameters: { sampleCount: 1, aspectRatio },
        }),
      }
    );
    const imagenData = await imagenRes.json();
    if (imagenRes.ok && imagenData.predictions?.[0]?.bytesBase64Encoded) {
      const imageData = Buffer.from(imagenData.predictions[0].bytesBase64Encoded, 'base64');
      const filename = `${postId || Date.now()}.png`;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), imageData);
      const imageUrl = `/images/${filename}`;
      if (postId) db.update(postId, { image_url: imageUrl });
      return res.json({ url: imageUrl, filename });
    }
    console.log('Imagen 4 failed:', imagenData.error?.message || 'No prediction');
  } catch (e) { console.log('Imagen 4 error:', e.message); }

  // Fallback: Nano Banana (gemini-2.5-flash-image via generateContent)
  try {
    console.log('Trying gemini-2.5-flash-image (Nano Banana)...');
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: enhancedPrompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      }
    );
    const data = await apiRes.json();
    if (!apiRes.ok) {
      const msg = data.error?.message || 'Erro na API';
      if (msg.includes('quota') || msg.includes('Quota')) {
        return res.status(402).json({ error: 'Quota excedida no plano gratuito. Ative o billing em https://aistudio.google.com/apikey → Plano pago para usar geração de imagem.' });
      }
      return res.status(500).json({ error: msg });
    }
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);
    if (!imagePart) return res.status(500).json({ error: 'Imagem não retornada pela API' });

    const imageData = Buffer.from(imagePart.inlineData.data, 'base64');
    const filename = `${postId || Date.now()}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), imageData);
    const imageUrl = `/images/${filename}`;
    if (postId) db.update(postId, { image_url: imageUrl });
    res.json({ url: imageUrl, filename });
  } catch (err) {
    console.error('Image generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AI Copy Rewrite (Gemini text) ─────────────────────────
app.post('/api/rewrite-copy', async (req, res) => {
  const { caption, hook, references, formato } = req.body;
  if (!caption && !hook) return res.status(400).json({ error: 'caption ou hook obrigatório' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY não configurada.' });

  try {
    const systemPrompt = `Voce e um copywriter especialista em conteudo para Instagram de infoprodutos digitais no Brasil.
Marca: Infomestre — criador de cursos digitais brasileiro, liderado por Joao Neto.
Tom: direto, provocador, moderno, sem enrolacao. Portugues brasileiro informal.
Formato: ${formato === 'reel' ? 'Reel (video curto, script falado em portugues BR)' : formato === 'carrossel' ? 'Carrossel (texto por slides em portugues BR)' : 'Post single (legenda unica em portugues BR)'}

REGRAS OBRIGATORIAS:
- Tudo em PORTUGUES BRASILEIRO (PT-BR)
- Linguagem conversacional brasileira real (nao de Portugal)
- Use girias e expressoes brasileiras quando fizer sentido
- Hook matador nos primeiros 3 segundos
- CTA claro e direto
- Sem cliches batidos
- Paragrafos curtos (maximo 2 linhas cada)
- Emojis com moderacao (maximo 3)

${references ? `Use estas referencias de estilo como inspiracao (NAO copie, apenas absorva o tom e estrutura):\n---\n${references}\n---` : ''}

Reescreva a copy abaixo mantendo a mesma ideia central mas melhorando tudo.

Retorne no formato JSON: { "hook": "...", "caption": "..." }`;

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nHook atual: ${hook}\nCaption atual: ${caption}` }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(500).json({ error: data.error?.message || 'Erro na API Gemini' });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    try {
      const result = JSON.parse(text);
      res.json(result);
    } catch {
      res.json({ hook: hook, caption: text });
    }
  } catch (err) {
    console.error('Rewrite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AI Section Rewrite (Hook / Corpo / CTA individual) ────
app.post('/api/rewrite-section', async (req, res) => {
  const { section, content, context, references, formato } = req.body;
  if (!section || !content) return res.status(400).json({ error: 'section e content obrigatorios' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY nao configurada.' });

  const sectionLabels = {
    hook: 'Hook (primeiros 3 segundos — a frase que para o scroll)',
    corpo: 'Corpo do script (desenvolvimento do conteudo, argumentacao principal)',
    cta: 'CTA — Call to Action (chamada para acao final, engajamento)',
  };

  const sectionRules = {
    hook: `- Maximo 2 linhas\n- Impactante, provocador, gera curiosidade\n- Deve fazer a pessoa parar de scrollar\n- Pode usar pergunta retorica, afirmacao chocante ou dado surpreendente`,
    corpo: `- Desenvolvimento do conteudo principal\n- Paragrafos curtos (max 2 linhas cada)\n- Linguagem conversacional brasileira\n- Entrega valor real, ensina ou provoca reflexao\n- Pode usar listas, comparacoes, storytelling`,
    cta: `- Maximo 2-3 linhas\n- Direto e claro\n- Convida para acao: seguir, salvar, comentar, compartilhar, clicar no link\n- Pode usar urgencia ou escassez\n- Termina com energia`,
  };

  try {
    const systemPrompt = `Voce e um copywriter especialista em conteudo para Instagram de infoprodutos digitais no Brasil.
Marca: Infomestre — criador de cursos digitais brasileiro, liderado por Joao Neto.
Tom: direto, provocador, moderno, sem enrolacao. Portugues brasileiro informal.
Formato: ${formato === 'reel' ? 'Reel (video curto, script falado em portugues BR)' : formato === 'carrossel' ? 'Carrossel (texto por slides em portugues BR)' : 'Post single (legenda unica em portugues BR)'}

VOCE ESTA REESCREVENDO APENAS A SECAO: ${sectionLabels[section] || section}

REGRAS PARA ESTA SECAO:
${sectionRules[section] || '- Reescreva mantendo a ideia central'}

REGRAS GERAIS:
- Tudo em PORTUGUES BRASILEIRO (PT-BR)
- Linguagem conversacional brasileira real
- Use girias e expressoes brasileiras quando fizer sentido
- Sem cliches batidos
- Emojis com moderacao (maximo 2)

${context ? `CONTEXTO DO POST COMPLETO (as outras secoes, para manter coerencia):\n${context}\n` : ''}
${references ? `REFERENCIAS DE ESTILO (NAO copie, apenas absorva o tom):\n${references}\n` : ''}

Reescreva APENAS a secao indicada, mantendo a ideia central mas melhorando tudo.
Retorne no formato JSON: { "rewritten": "..." }`;

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nTexto atual da secao:\n${content}` }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(500).json({ error: data.error?.message || 'Erro na API Gemini' });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    try {
      const result = JSON.parse(text);
      res.json({ rewritten: result.rewritten || text });
    } catch {
      res.json({ rewritten: text });
    }
  } catch (err) {
    console.error('Section rewrite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Generate image prompt with AI ─────────────────────────────
app.post('/api/generate-prompt', async (req, res) => {
  const { slideLabel, slideContent, context, formato } = req.body;
  if (!slideContent) return res.status(400).json({ error: 'slideContent obrigatorio' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY nao configurada.' });

  try {
    const systemPrompt = `Voce e um diretor de arte especialista em conteudo visual para Instagram de infoprodutos digitais no Brasil.
Marca: Infomestre — criador de cursos digitais brasileiro.

ESTILO VISUAL OBRIGATORIO (baseado nos templates BrandsDecoded):
- Estetica FUTURISTA e TECH: visual clean, premium, high-end digital
- Fundo predominantemente preto profundo (#0A0A0A) com gradientes sutis escuros
- Destaque verde limao neon (#CCFF00) como cor de acento — usado em highlights, bordas, glows
- Branco (#FFFFFF) para elementos secundarios e contraste
- Elementos visuais: formas geometricas abstratas, linhas finas luminosas, grids tech, patterns de circuito
- Efeitos: glow neon sutil, glassmorphism, gradientes escuros, reflexos metalicos
- Composicao: layouts assimetricos modernos, bastante espaco negativo, hierarquia visual forte
- Mood: futurista, sofisticado, tech, inovador, premium
- Inspiracao: design de interfaces futuristas, dashboards tech, estetica cyberpunk refinada
- SEM texto renderizado na imagem (texto sera adicionado por cima no Canva)

Voce precisa criar um PROMPT para geracao de imagem de IA baseado no conteudo do slide.
Formato: ${formato === 'carrossel' ? 'Carrossel Instagram (1:1 ou 4:5)' : formato === 'single' ? 'Post unico Instagram (1:1)' : 'Reel Instagram (9:16)'}
${slideLabel ? `Tipo de slide: ${slideLabel}` : ''}

REGRAS:
- O prompt deve ser em INGLES (para melhor resultado na geracao)
- Descreva o estilo visual BrandsDecoded futurista: composicao, cores escuras, glow neon verde, mood tech
- Mencione que e para Instagram, profissional, alta qualidade, 4K
- NAO inclua texto na imagem — apenas elementos visuais e graficos
- Sem marcas d'agua
- Adapte o visual ao tipo de slide (hook = impactante com glow forte, dados = infografico tech, CTA = call to action visual com destaque neon)
- Sempre inclua: "dark futuristic tech aesthetic, black background (#0A0A0A), neon lime green (#CCFF00) accents, geometric shapes, subtle glow effects"

${context ? `Contexto do post completo:\n${context}\n` : ''}

Retorne APENAS o prompt em ingles, sem explicacoes. JSON: { "prompt": "..." }`;

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nConteudo do slide:\n${slideContent}` }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(500).json({ error: data.error?.message || 'Erro API' });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    try {
      const result = JSON.parse(text);
      res.json({ prompt: result.prompt || text });
    } catch {
      res.json({ prompt: text });
    }
  } catch (err) {
    console.error('Generate prompt error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Fetch news with AI + Google Search grounding ──────────────
app.post('/api/fetch-news', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY nao configurada.' });

  try {
    const systemPrompt = `Voce e um curador de noticias sobre tecnologia, IA, automacao e marketing digital.

Busque as NOTICIAS MAIS RECENTES E RELEVANTES de hoje ou desta semana sobre:
- Inteligencia Artificial (novos modelos, ferramentas, atualizacoes)
- Automacao de marketing e vendas
- Big Tech (Google, Meta, OpenAI, Microsoft, Apple)
- Ferramentas digitais e SaaS
- Tendencias de infoprodutos e marketing digital

FONTES PRIORITARIAS: TechCrunch, Wired, The Verge, VentureBeat, Ars Technica, CNET, Artificial Intelligence News, IA Brasil Noticias, InfoMoney, Exame, CNN Brasil, Canaltech, IT Forum

REGRAS:
- Retorne entre 6 a 10 noticias REAIS e ATUAIS
- Cada noticia deve ter: titulo, resumo curto (2-3 frases), fonte (nome do site), e URL real
- Priorize noticias de HOJE ou dos ultimos 3 dias
- Foque em noticias que impactam infoprodutores e empreendedores digitais brasileiros
- Tudo em PORTUGUES BRASILEIRO

Retorne JSON: { "news": [{ "title": "...", "summary": "...", "source": "...", "url": "..." }] }`;

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(500).json({ error: data.error?.message || 'Erro API Gemini' });

    // Google Search grounding returns text (not structured JSON), so extract JSON from it
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return res.json({ news: result.news || [] });
      } catch {}
    }
    // If no valid JSON, try to parse structured news from text
    res.json({ news: [] });
  } catch (err) {
    console.error('Fetch news error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Generate all slide TEXT content with AI (pilar-specific) ─────
const PILAR_PROMPTS = {
  bastidores: `Voce esta criando conteudo para o pilar BASTIDORES do Instagram @ojoaonetocp (Infomestre).
Estilo: autenticidade crua, vulnerabilidade, mostra o processo real sem glamour.
Tom: pessoal, honesto, como se estivesse falando com um amigo.
Objetivo: conectar mostrando os bastidores reais de construir um negocio digital.
Exemplos de angulos: rotina real, erros cometidos, decisoes dificeis, momentos de duvida, vitorias pequenas.
Referencia: mostra o lado humano do empreendedor, nao o lado perfeito.`,

  sistemas: `Voce esta criando conteudo para o pilar SISTEMAS do Instagram @ojoaonetocp (Infomestre).
Estilo: tecnico mas acessivel, passo a passo pratico, foco em automacao.
Tom: professor pratico, direto, mostra o caminho.
Objetivo: ensinar sistemas e automacoes que fazem o negocio rodar sozinho.
Exemplos de angulos: funis perpetuos, automacoes de e-mail, checkout otimizado, suporte com IA, fluxos automaticos.
Referencia: cada slide deve ensinar algo aplicavel imediatamente.`,

  'ia-aplicada': `Voce esta criando conteudo para o pilar IA APLICADA do Instagram @ojoaonetocp (Infomestre).
Estilo: tutorial pratico, demonstracao de ferramentas, prompts prontos.
Tom: entusiasmado com tecnologia, mas pratico e focado em resultado.
Objetivo: mostrar como usar IA no dia a dia do infoproduto para economizar tempo e dinheiro.
Exemplos de angulos: ferramentas de IA, prompts para copy, automacao com ChatGPT, geracao de conteudo, analise com IA.
Referencia: sempre incluir o nome da ferramenta e como usar na pratica.`,

  provocacao: `Voce esta criando conteudo para o pilar PROVOCACAO do Instagram @ojoaonetocp (Infomestre).
Estilo: controverso, desafiador, questiona o senso comum do mercado.
Tom: provocador, ousado, sem medo de incomodar. Fala verdades que ninguem fala.
Objetivo: gerar debate, engajamento e fazer as pessoas repensarem suas crencas.
Exemplos de angulos: mitos do mercado digital, erros que todo mundo comete, verdades incomodas, comparacoes brutais.
Referencia: cada slide deve gerar uma reacao emocional — raiva, concordancia ou reflexao.`,

  resultado: `Voce esta criando conteudo para o pilar RESULTADO do Instagram @ojoaonetocp (Infomestre).
Estilo: orientado a dados, provas concretas, transparencia total.
Tom: confiante mas humilde, mostra numeros reais sem exagero.
Objetivo: provar que o metodo funciona com resultados reais e metricas.
Exemplos de angulos: faturamento, conversao, ROI, depoimentos, prints de dashboard, antes vs depois.
Referencia: numeros especificos > afirmacoes genericas. Mostra o processo que gerou o resultado.`,

  noticias: `Voce esta criando conteudo para o pilar NOTICIAS do Instagram @ojoaonetocp (Infomestre).
Estilo: jornalistico mas opinativo, analise de mercado, tendencias de IA e marketing digital.
Tom: informado, analitico, conecta a noticia com oportunidade pratica para infoprodutores.
Objetivo: posicionar como autoridade em noticias do mercado digital e IA, sempre conectando com oportunidades praticas.

FONTES DE REFERENCIA OBRIGATORIAS (busque informacoes reais e atuais):
- Tech global: TechCrunch, Wired, The Verge, VentureBeat, Ars Technica, CNET, Engadget, ZDNet
- IA especializado: Artificial Intelligence News, IA Brasil Noticias
- Negocios/financeiro: InfoMoney, Exame, CNN Brasil (secao IA)
- Tech BR: Canaltech, IT Forum
- Newsletters de IA: TLDR AI, AI Breakfast, Superhuman AI, Mindstream

Referencia estilo: @hollyfield.ia — noticias de IA traduzidas para oportunidades praticas.

REGRAS ESPECIFICAS:
- Sempre cite a FONTE real da noticia (ex: "Segundo o TechCrunch...", "De acordo com a Wired...")
- Traga NOTICIAS REAIS e RECENTES sobre o tema solicitado
- Conecte cada noticia com impacto pratico para infoprodutores brasileiros
- Mostre o que o infoprodutor deve fazer AGORA com base na noticia
- Combine: 1 fonte de noticias rapidas + 1 analise profunda + impacto pratico
- Use dados, numeros e fatos concretos sempre que possivel`,
};

app.post('/api/generate-slides-content', async (req, res) => {
  const { pilar, hook, topic, slides, formato } = req.body;
  const input = topic || hook || ''; // can be empty for auto-idea mode
  if (!pilar || !slides) return res.status(400).json({ error: 'pilar e slides obrigatorios' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY nao configurada.' });

  const pilarContext = PILAR_PROMPTS[pilar] || PILAR_PROMPTS['bastidores'];
  const slideLabels = slides.map((s, i) => `Slide ${i + 1}: ${s.label}`).join('\n');

  // Determine mode: auto-idea (no input), topic-based, or hook-based
  const isAutoIdea = !input.trim();
  const isTopicBased = !!topic;

  try {
    let contextBlock = '';
    if (isAutoIdea) {
      contextBlock = `Voce precisa INVENTAR uma ideia ORIGINAL e RELEVANTE de post para o pilar descrito acima.
Crie algo que seria viral no Instagram de infoprodutos. Pense em:
- O que o publico-alvo esta sentindo/pensando agora
- Tendencias atuais do mercado digital
- Dores e desejos de infoprodutores brasileiros
- Algo provocador, educativo ou inspirador

Depois de definir a ideia:
1. Crie um HOOK poderoso (a frase de capa que para o scroll)
2. Desenvolva o conteudo completo de cada slide
3. O hook deve ser curto (1-2 linhas), impactante, e fazer a pessoa querer ver o resto do carrossel.`;
    } else if (isTopicBased) {
      contextBlock = `O TEMA/ASSUNTO do post e: "${input}"
Baseado neste tema, voce precisa:
1. Criar um HOOK poderoso (a frase de capa que para o scroll) relacionado ao tema
2. Pesquisar/desenvolver o conteudo com base no tema descrito
3. Gerar o conteudo textual de cada slide

O hook deve ser curto (1-2 linhas), impactante, e fazer a pessoa querer ver o resto do carrossel.`;
    } else {
      contextBlock = `O HOOK do post e: "${input}"`;
    }

    const systemPrompt = `Voce e um copywriter e estrategista de conteudo do Instagram @ojoaonetocp — marca Infomestre.
Criador: Joao Neto, infoprodutor brasileiro que ensina a criar e automatizar infoprodutos com IA.

${pilarContext}

REGRAS OBRIGATORIAS:
- Tudo em PORTUGUES BRASILEIRO (PT-BR) natural e conversacional
- Linguagem informal brasileira real (nao de Portugal)
- Paragrafos curtos (maximo 2 linhas)
- Cada slide deve ter entre 2 a 5 linhas de conteudo
- O slide do Hook deve ser impactante e curto (1-2 linhas)
- O slide do CTA deve ter chamada clara para acao (seguir, salvar, comentar, link na bio)
- Sem emojis excessivos (maximo 1 por slide)
- Sem cliches batidos
- Formato: ${formato === 'carrossel' ? 'Carrossel Instagram — texto visual para cada slide' : 'Post Instagram'}
- O conteudo deve fluir naturalmente de um slide para o proximo

${contextBlock}

Voce precisa gerar o CONTEUDO TEXTUAL para cada slide abaixo:
${slideLabels}

Retorne um JSON com:
- "hook": a frase de hook do post (crie um hook IMPACTANTE e ORIGINAL${input.trim() ? ' baseado no tema/hook fornecido' : ''})
- "caption": uma legenda curta para o post no Instagram (2-4 linhas, com hashtags relevantes)
- "slides": array onde cada item tem "label" (exatamente como fornecido) e "content" (o texto gerado)

Exemplo: { "hook": "frase impactante...", "caption": "legenda do post...", "slides": [{ "label": "Hook — capa", "content": "texto gerado..." }, ...] }`;

    // Always use structured JSON output — no grounding needed here
    // (news info is already in the topic/hook from user selection)
    const requestBody = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    };

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(500).json({ error: data.error?.message || 'Erro API Gemini' });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('generate-slides-content raw response length:', text.length);
    try {
      const result = JSON.parse(text);
      res.json({
        hook: result.hook || input || 'Post gerado com IA',
        caption: result.caption || '',
        slides: result.slides || [],
      });
    } catch (parseErr) {
      console.error('JSON parse error, trying extraction...', parseErr.message);
      // Try to extract JSON block from response
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"slides"[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const cleaned = jsonMatch[1] || jsonMatch[0];
          const result = JSON.parse(cleaned);
          return res.json({
            hook: result.hook || input || 'Post gerado com IA',
            caption: result.caption || '',
            slides: result.slides || [],
          });
        } catch {}
      }
      console.error('Could not extract JSON from response');
      res.json({ hook: input || 'Post gerado com IA', caption: '', slides: [] });
    }
  } catch (err) {
    console.error('Generate slides content error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Batch generate images for carousel slides ──────────────────
app.post('/api/generate-slides-images', async (req, res) => {
  const { postId, slides, aspectRatio = '1:1' } = req.body;
  if (!slides || !Array.isArray(slides)) return res.status(400).json({ error: 'slides obrigatorio' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY nao configurada.' });

  const results = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (!slide.image_prompt) {
      results.push({ index: i, url: null, error: 'Sem prompt' });
      continue;
    }

    const enhancedPrompt = `Slide ${i + 1} of Instagram carousel for Infomestre brand. Style: dark futuristic tech aesthetic inspired by BrandsDecoded templates. Deep black background (#0A0A0A), neon lime green (#CCFF00) accent glows and highlights, white secondary elements. Visual elements: abstract geometric shapes, thin luminous lines, tech grid patterns, circuit-like patterns. Effects: subtle neon glow, glassmorphism, dark gradients, metallic reflections. Composition: modern asymmetric layout, strong visual hierarchy, ample negative space. ${slide.image_prompt}. Professional, high-quality, 4K. No text, no watermarks. No rendered typography.`;

    try {
      // Try Imagen 4.0
      const imagenRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: enhancedPrompt }],
            parameters: { sampleCount: 1, aspectRatio },
          }),
        }
      );
      const imagenData = await imagenRes.json();
      if (imagenRes.ok && imagenData.predictions?.[0]?.bytesBase64Encoded) {
        const imageData = Buffer.from(imagenData.predictions[0].bytesBase64Encoded, 'base64');
        const filename = `${postId || Date.now()}-slide-${i + 1}.png`;
        fs.writeFileSync(path.join(IMAGES_DIR, filename), imageData);
        results.push({ index: i, url: `/images/${filename}` });
        continue;
      }

      // Fallback to Nano Banana
      const nbRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: enhancedPrompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
        }
      );
      const nbData = await nbRes.json();
      const parts = nbData.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData);
      if (imagePart) {
        const imageData = Buffer.from(imagePart.inlineData.data, 'base64');
        const filename = `${postId || Date.now()}-slide-${i + 1}.png`;
        fs.writeFileSync(path.join(IMAGES_DIR, filename), imageData);
        results.push({ index: i, url: `/images/${filename}` });
      } else {
        results.push({ index: i, url: null, error: 'Imagem nao retornada' });
      }
    } catch (err) {
      console.error(`Slide ${i + 1} image error:`, err.message);
      results.push({ index: i, url: null, error: err.message });
    }
  }

  // Update post slides with generated URLs
  if (postId) {
    const post = db.findById(postId);
    if (post && post.slides) {
      const updatedSlides = [...(post.slides || [])];
      for (const r of results) {
        if (r.url && updatedSlides[r.index]) {
          updatedSlides[r.index].image_url = r.url;
        }
      }
      db.update(postId, { slides: updatedSlides });
    }
  }

  res.json({ results });
});

// ── Export to DOCX (Google Docs compatible) ─────────────────
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');

app.get('/api/posts/:id/export-doc', async (req, res) => {
  const post = db.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post nao encontrado' });

  const isReel = post.formato === 'reel';
  const pilarLabels = {
    'bastidores': 'Bastidores', 'sistemas': 'Sistemas', 'ia-aplicada': 'IA Aplicada',
    'provocacao': 'Provocacao', 'resultado': 'Resultado', 'noticias': 'Noticias'
  };
  const formatoLabels = { 'reel': 'Reel', 'carrossel': 'Carrossel', 'single': 'Post Unico' };

  const children = [
    // Title
    new Paragraph({
      children: [new TextRun({ text: 'INFOMESTRE', bold: true, size: 32, color: '8BC34A', font: 'Arial' })],
      alignment: AlignmentType.CENTER, spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Conteudo Instagram — ${formatoLabels[post.formato] || post.formato}`, size: 20, color: '666666', font: 'Arial' })],
      alignment: AlignmentType.CENTER, spacing: { after: 300 },
    }),
    // Metadata
    new Paragraph({
      children: [
        new TextRun({ text: 'Pilar: ', bold: true, size: 20, font: 'Arial' }),
        new TextRun({ text: pilarLabels[post.pilar] || post.pilar, size: 20, font: 'Arial' }),
        new TextRun({ text: '   |   Formato: ', bold: true, size: 20, font: 'Arial' }),
        new TextRun({ text: formatoLabels[post.formato] || post.formato, size: 20, font: 'Arial' }),
        ...(post.scheduled_date ? [
          new TextRun({ text: '   |   Data: ', bold: true, size: 20, font: 'Arial' }),
          new TextRun({ text: post.scheduled_date, size: 20, font: 'Arial' }),
        ] : []),
      ],
      spacing: { after: 300 },
    }),
    // Separator
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } }, spacing: { after: 300 } }),
  ];

  // Hook
  children.push(
    new Paragraph({ text: 'HOOK', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: post.hook || '(vazio)', size: 22, font: 'Arial' })], spacing: { after: 200 } }),
  );

  if (isReel) {
    // Corpo
    children.push(
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } }, spacing: { after: 200 } }),
      new Paragraph({ text: 'CORPO DO SCRIPT', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
    );
    (post.corpo || '(vazio)').split('\n').forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'Arial' })], spacing: { after: 80 } }));
    });

    // CTA
    children.push(
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } }, spacing: { after: 200 } }),
      new Paragraph({ text: 'CTA (CHAMADA PARA ACAO)', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
    );
    (post.cta || '(vazio)').split('\n').forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'Arial' })], spacing: { after: 80 } }));
    });
  } else {
    // Caption
    children.push(
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } }, spacing: { after: 200 } }),
      new Paragraph({ text: 'CAPTION', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
    );
    (post.caption || '(vazio)').split('\n').forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'Arial' })], spacing: { after: 80 } }));
    });
  }

  // Hashtags
  if (post.hashtags) {
    children.push(
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } }, spacing: { after: 200 } }),
      new Paragraph({ text: 'HASHTAGS', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: post.hashtags, size: 20, color: '4A90D9', font: 'Arial' })], spacing: { after: 200 } }),
    );
  }

  // Notes
  if (post.notes) {
    children.push(
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } }, spacing: { after: 200 } }),
      new Paragraph({ text: 'NOTAS INTERNAS', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: post.notes, size: 20, italics: true, color: '999999', font: 'Arial' })], spacing: { after: 200 } }),
    );
  }

  const doc = new Document({
    sections: [{ children }],
    creator: 'Infomestre - Insta Manager',
    title: `Copy - ${post.hook ? post.hook.substring(0, 50) : 'Post'}`,
  });

  const buffer = await Packer.toBuffer(doc);
  const safeName = (post.hook || 'post').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').substring(0, 40);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="infomestre-${safeName}.docx"`);
  res.send(buffer);
});

// ── Settings ──────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.post('/api/settings', (req, res) => {
  db.saveSettings(req.body);
  res.json({ ok: true });
});

// ── Serve React in production ──────────────────────────────
const DIST = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => console.log(`Insta Manager running on http://localhost:${PORT}`));
