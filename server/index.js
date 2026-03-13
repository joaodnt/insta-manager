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
  const { hook, caption, corpo, cta, pilar, formato, status, scheduled_date, image_url, image_prompt, video_url, hashtags, notes } = req.body;
  if (!hook || !pilar || !formato) return res.status(400).json({ error: 'hook, pilar e formato são obrigatórios' });
  const post = db.insert({ hook, caption: caption || '', corpo: corpo || '', cta: cta || '', pilar, formato, status: status || 'rascunho', scheduled_date: scheduled_date || null, image_url: image_url || null, image_prompt: image_prompt || '', video_url: video_url || null, hashtags: hashtags || '', notes: notes || '' });
  res.status(201).json(post);
});

app.put('/api/posts/:id', (req, res) => {
  const post = db.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const fields = ['hook','caption','corpo','cta','pilar','formato','status','scheduled_date','image_url','image_prompt','hashtags','notes','video_url'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  res.json(db.update(req.params.id, updates));
});

app.delete('/api/posts/:id', (req, res) => {
  if (!db.remove(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
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
