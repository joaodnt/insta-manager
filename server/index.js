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
  const { prompt, postId, aspectRatio = '1:1' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt obrigatório' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY não configurada.' });

  const enhancedPrompt = `${prompt}. Professional, ultra-detailed, 4K quality background image for Instagram post. Absolutely no text, no typography, no letters, no words in the image. No watermarks. Visual only.`;

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
  const { slideLabel, slideContent, context, formato, slideIndex, allSlides } = req.body;
  if (!slideContent) return res.status(400).json({ error: 'slideContent obrigatorio' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY nao configurada.' });

  // Build carousel context — show ALL slides so AI knows what's different about THIS one
  let carouselContext = '';
  if (allSlides && Array.isArray(allSlides) && allSlides.length > 1) {
    const allCtx = allSlides
      .filter(s => s.content)
      .map((s, i) => `Slide ${i + 1} (${s.label}): "${s.content.substring(0, 100)}"${i === (slideIndex || 0) ? ' ← THIS IS THE CURRENT SLIDE' : ''}`)
      .join('\n');
    if (allCtx) {
      carouselContext = `\nALL SLIDES IN THIS CAROUSEL (each needs a COMPLETELY DIFFERENT scene/angle/setting):\n${allCtx}\n\nCRITICAL: This is slide ${(slideIndex || 0) + 1}. Each slide MUST have a unique visual scene. Do NOT reuse the same setting, angle, or composition from other slides.\n`;
    }
  }

  try {
    const systemPrompt = `You are an expert image prompt engineer. Your ONLY job is to create a prompt for AI image generation (Imagen 4).

INPUT: A slide text from an Instagram carousel about tech/AI/digital business.
OUTPUT: A JSON with a single "prompt" field containing an image generation prompt in English.

STEP 1 — EXTRACT from the slide text:
- Company names (Google, Apple, Meta, OpenAI, Microsoft, Wiz, etc.)
- Product names (Google Cloud, ChatGPT, YouTube, etc.)
- Technologies (AI, machine learning, cybersecurity, blockchain, etc.)
- Concepts (security, automation, data centers, etc.)

STEP 2 — BUILD the prompt using REAL, RECOGNIZABLE visual elements:
For each entity found, describe a PHOTOREALISTIC scene featuring that entity:
- Google → Google headquarters building (Googleplex), the real Google logo on a building, Google Cloud server room with real racks
- YouTube → the real YouTube red play button icon, YouTube HQ in San Bruno, YouTube app interface on a real phone screen
- Apple → Apple Park aerial view, the real Apple logo on glass building, real MacBook/iPhone products on a desk
- OpenAI → real OpenAI office lobby, ChatGPT interface on a real computer monitor, Sam Altman speaking
- Meta → real Meta headquarters sign with Infinity loop logo, real Quest VR headsets on display
- Microsoft → real Microsoft campus in Redmond, Azure data center interior, real Surface devices
- Wiz → real cybersecurity operations center with multiple screens showing dashboards, cloud security monitoring room
- Security/cybersecurity → real security operations center (SOC) with analysts at screens, server room with blinking lights
- AI → real NVIDIA GPU chips on a circuit board, real data center corridor with server racks, real robot arm in lab
- Automation → real robotic arms in a car factory, real warehouse with automated conveyor belts
- Ecommerce → real Amazon-style fulfillment center, real shopping app on phone screen
- Startup → real modern Silicon Valley office, real whiteboard with sticky notes, real team meeting

STEP 3 — COMPOSE the final prompt:
Combine the real elements into a PHOTOREALISTIC scene that looks like a real photograph.

MANDATORY STYLE RULES:
- PHOTOREALISTIC — must look like a real photo taken with a professional camera
- Real-world lighting: natural daylight, office fluorescent lights, screen glow — NOT neon, NOT dark moody
- Real locations, real buildings, real products, real people (when appropriate)
- Professional editorial photography style, 4K, ultra-detailed, sharp focus
- ABSOLUTELY NO TEXT, NO TYPOGRAPHY, NO LETTERS, NO WORDS in the image
- No watermarks, no overlays, no abstract shapes, no geometric patterns
- Slightly dimmed with a subtle dark vignette at the edges so text can be placed on top later

SLIDE-SPECIFIC VISUAL DIFFERENTIATION (CRITICAL for carousels):
Based on the slide type, use DIFFERENT visual approaches:
- Hook slide → dramatic wide shot, hero image, most impactful visual
- Context/story slides → medium shot showing the scenario, environment, workplace
- Data/stats slides → close-up of screens with dashboards, charts on monitors
- Process/how-to slides → hands working, tools in action, step-by-step visual
- Problem/challenge slides → contrasting scene, obstacles, before state
- Result/impact slides → success scene, growth visualization, achievement
- Opinion/analysis slides → person thinking, expert at desk, analysis setup
- CTA slides → forward-looking scene, path ahead, invitation visual

${formato === 'carrossel' ? 'Format: Instagram carousel slide' : formato === 'single' ? 'Format: Instagram single post' : 'Format: Instagram Reel (9:16 vertical)'}
${slideLabel ? `Slide type: ${slideLabel}` : ''}
${carouselContext}
${context ? `Full post context:\n${context}\n` : ''}

Return ONLY valid JSON: { "prompt": "..." }`;

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nSlide text to visualize (DO NOT render this text in the image, extract the entities and create a photorealistic scene):\n"${slideContent}"` }] }],
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
    // ═══ STEP 1: Use Google Search grounding to get REAL URLs ═══
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const searchPrompt = `Busque SOMENTE noticias publicadas entre ${weekAgo} e ${today} (ultimos 7 dias) sobre:
- Inteligencia Artificial (novos modelos, ferramentas, atualizacoes da OpenAI, Google, Meta, etc)
- Automacao de marketing e vendas
- Big Tech (Google, Meta, OpenAI, Microsoft, Apple, Amazon)
- Ferramentas digitais e SaaS
- Tendencias de mercado digital

IMPORTANTE:
- SOMENTE noticias dos ULTIMOS 7 DIAS (de ${weekAgo} ate ${today})
- Ordene da MAIS RECENTE para a MAIS ANTIGA
- Para cada noticia, mencione a data de publicacao
- Priorize noticias de HOJE e de ONTEM

Liste cada noticia encontrada com titulo, data de publicacao e resumo curto.`;

    const searchRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: searchPrompt }] }],
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      console.error('Fetch news search error:', JSON.stringify(searchData.error || searchData));
      return res.status(500).json({ error: searchData.error?.message || 'Erro API Gemini' });
    }

    // Extract grounding metadata
    const groundingMeta = searchData.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMeta?.groundingChunks || [];
    const rawGroundingUrls = groundingChunks
      .filter(c => c.web && c.web.uri)
      .map(c => ({ title: (c.web.title || '').trim(), redirectUrl: c.web.uri }));

    console.log('Grounding chunks found:', rawGroundingUrls.length);

    // Get the AI text content (has the actual news summaries)
    const searchText = (searchData.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');

    // ═══ STEP 2: Resolve redirect URLs to get REAL article URLs ═══
    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    async function resolveRedirect(url) {
      try {
        // Use manual redirect to capture Location header
        const resp = await fetch(url, { method: 'GET', redirect: 'manual', headers: browserHeaders, signal: AbortSignal.timeout(8000) });
        const location = resp.headers.get('location');
        if (location && !location.includes('vertexaisearch') && !location.includes('grounding-api-redirect')) {
          return location;
        }
        // If manual didn't work, try following
        const resp2 = await fetch(url, { method: 'GET', redirect: 'follow', headers: browserHeaders, signal: AbortSignal.timeout(8000) });
        const finalUrl = resp2.url;
        resp2.body?.cancel();
        if (finalUrl && !finalUrl.includes('vertexaisearch') && !finalUrl.includes('grounding-api-redirect')) {
          return finalUrl;
        }
        return url;
      } catch {
        return url; // Return original if resolution fails
      }
    }

    // Resolve all redirect URLs in parallel
    const resolvedUrls = await Promise.all(
      rawGroundingUrls.slice(0, 10).map(async (g) => {
        const isRedirect = g.redirectUrl.includes('vertexaisearch.cloud.google.com') ||
                           g.redirectUrl.includes('grounding-api-redirect');
        const realUrl = isRedirect ? await resolveRedirect(g.redirectUrl) : g.redirectUrl;
        console.log(`  Resolved: ${g.title} → ${realUrl}`);
        return { title: g.title, url: realUrl };
      })
    );

    // Filter out URLs that still point to Google (resolution failed)
    const validUrls = resolvedUrls.filter(u =>
      !u.url.includes('vertexaisearch.cloud.google.com') &&
      !u.url.includes('grounding-api-redirect') &&
      u.url.startsWith('http')
    );

    console.log('Resolved valid URLs:', validUrls.length);

    // If redirect resolution failed, try extracting URLs from the AI text itself
    if (validUrls.length === 0) {
      console.log('No valid URLs from grounding redirect. Trying to extract from text...');
      const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/g;
      const textUrls = [...new Set((searchText.match(urlRegex) || []).filter(u =>
        !u.includes('vertexaisearch') && !u.includes('grounding-api-redirect') && !u.includes('google.com/search')
      ))];
      if (textUrls.length > 0) {
        console.log('Found URLs in text:', textUrls.length);
        textUrls.slice(0, 10).forEach((u, i) => {
          const titleMatch = rawGroundingUrls[i];
          validUrls.push({ title: titleMatch?.title || `Noticia ${i + 1}`, url: u });
        });
      }
    }

    // Also try parsing searchEntryPoint for real links
    if (validUrls.length === 0 && groundingMeta?.searchEntryPoint?.renderedContent) {
      const html = groundingMeta.searchEntryPoint.renderedContent;
      const hrefRegex = /href="(https?:\/\/[^"]+)"/g;
      let hrefMatch;
      while ((hrefMatch = hrefRegex.exec(html)) !== null) {
        const href = hrefMatch[1];
        if (!href.includes('google.com')) {
          validUrls.push({ title: '', url: href });
        }
      }
      console.log('Found URLs in searchEntryPoint:', validUrls.length);
    }

    if (validUrls.length === 0 && !searchText) {
      return res.json({ news: [], error: 'Nenhuma noticia encontrada' });
    }

    // ═══ STEP 3: Ask AI to format news items with real URLs ═══
    const urlList = validUrls.map((g, i) =>
      `${i + 1}. TITULO: ${g.title}\n   URL_REAL: ${g.url}`
    ).join('\n');

    const describePrompt = `Aqui estao noticias reais encontradas via Google Search. Para cada uma, crie um titulo atrativo em portugues, um resumo curto e identifique a data de publicacao.

NOTICIAS COM URLs REAIS VERIFICADAS:
${urlList}

CONTEXTO ADICIONAL DAS NOTICIAS:
${searchText.substring(0, 3000)}

DATA DE HOJE: ${today}

REGRAS:
- Titulo em PORTUGUES BRASILEIRO, atrativo para Instagram
- Resumo curto (2-3 frases) em PT-BR focado em impacto para empreendedores digitais
- Source = nome do site (extraia do dominio da URL_REAL)
- URL = copie EXATAMENTE a URL_REAL fornecida — NAO modifique nenhum caractere
- date = data de publicacao no formato "YYYY-MM-DD" (extraia do contexto ou URL). Se nao souber, use "${today}"
- ORDENE da mais recente para a mais antiga
- DESCARTE noticias com mais de 7 dias (anteriores a ${weekAgo})
- Retorne TODAS as noticias validas

JSON: { "news": [{ "title": "...", "summary": "...", "source": "...", "url": "copiar URL_REAL exata", "date": "YYYY-MM-DD" }] }`;

    const descRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: describePrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    const descData = await descRes.json();
    let newsItems = [];

    if (descRes.ok) {
      const descText = (descData.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      try {
        const result = JSON.parse(descText);
        newsItems = result.news || [];
      } catch {
        const jsonMatch = descText.match(/\{[\s\S]*"news"[\s\S]*\[[\s\S]*\][\s\S]*\}/);
        if (jsonMatch) {
          try { newsItems = JSON.parse(jsonMatch[0]).news || []; } catch {}
        }
      }
    }

    // ═══ STEP 4: FORCE real URLs — ALWAYS override with our resolved URLs ═══
    for (let i = 0; i < newsItems.length; i++) {
      if (validUrls[i]) {
        newsItems[i].url = validUrls[i].url; // ALWAYS use resolved real URL
        if (!newsItems[i].source) {
          try { newsItems[i].source = new URL(validUrls[i].url).hostname.replace('www.', ''); } catch {}
        }
      }
    }

    // Add any remaining resolved URLs not covered by AI
    for (let i = newsItems.length; i < validUrls.length; i++) {
      let source = '';
      try { source = new URL(validUrls[i].url).hostname.replace('www.', ''); } catch {}
      newsItems.push({
        title: validUrls[i].title || `Noticia ${i + 1}`,
        summary: '',
        source,
        url: validUrls[i].url,
      });
    }

    console.log('Fetch news final:', newsItems.length, 'items with REAL resolved URLs');
    res.json({ news: newsItems });
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

  react: `Voce esta criando conteudo para o pilar REACT do Instagram @ojoaonetocp (Infomestre).
Estilo: REACAO a noticias — informal, opinativo, como se estivesse reagindo ao vivo. Estilo "react" de criador de conteudo.
Tom: descontraido, provocador, com opiniao forte. Como se estivesse contando a noticia pra um amigo no bar.
Objetivo: reagir a noticias do mercado digital/IA mostrando COMO ISSO IMPACTA a vida real de infoprodutores e empreendedores.

ESTILO DE LINGUAGEM:
- Informal total: "mano", "cara", "olha so", "pensa comigo", "isso e INSANO"
- Reacoes emocionais: surpresa, indignacao, empolgacao, preocupacao
- Fala como se tivesse acabado de ver a noticia e esta reagindo na hora
- Use girias brasileiras naturais, sem forcar
- Opinioes FORTES — nao fique em cima do muro

ESTRUTURA DE REACT:
1. Reacao inicial impactante (o hook que para o scroll)
2. Conta a noticia de forma rapida e clara (SEMPRE com a fonte e link)
3. Da sua opiniao CRUA sobre o que isso significa
4. Mostra o impacto pratico: "e pra voce que [faz X], isso muda tudo porque..."
5. O que VOCE faria se fosse o seguidor
6. Previsao ousada sobre o futuro

REGRA CRITICA:
- SEMPRE inclua o LINK REAL da noticia original no conteudo
- Formate assim: "Fonte: [Nome do Site] — [URL completa]"
- O link deve aparecer no slide da noticia E na caption
- Se a noticia foi passada no hook/topic, extraia o link de la e use no conteudo`,
};

// ── Generate content for Reel/Single posts (hook + corpo + CTA + caption) ────
app.post('/api/generate-post-content', async (req, res) => {
  const { pilar, topic, formato } = req.body;
  if (!pilar) return res.status(400).json({ error: 'pilar obrigatorio' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY nao configurada.' });

  const pilarContext = PILAR_PROMPTS[pilar] || PILAR_PROMPTS['bastidores'];
  const input = topic || '';
  const isAutoIdea = !input.trim();

  let contextBlock = '';
  if (isAutoIdea) {
    contextBlock = `Voce precisa INVENTAR uma ideia ORIGINAL e RELEVANTE de post para o pilar descrito acima.
Crie algo que seria viral no Instagram de infoprodutos. Pense em:
- O que o publico-alvo esta sentindo/pensando agora
- Tendencias atuais do mercado digital
- Dores e desejos de infoprodutores brasileiros
- Algo provocador, educativo ou inspirador`;
  } else {
    // Extract URL from topic if present (for react/noticias pilars)
    const urlMatch = input.match(/https?:\/\/[^\s)]+/);
    const newsUrl = urlMatch ? urlMatch[0] : '';
    const linkInstruction = newsUrl ? `\n\nIMPORTANTE: O link da noticia original e: ${newsUrl}\n- INCLUA este link no corpo do conteudo\n- INCLUA este link na caption\n- Formate: "Fonte: [Site] — ${newsUrl}"` : '';

    contextBlock = `O TEMA/ASSUNTO do post e: "${input}"
Baseado neste tema, pesquise/desenvolva o conteudo.${linkInstruction}`;
  }

  const isReel = formato === 'reel';

  const systemPrompt = `Voce e um copywriter e estrategista de conteudo do Instagram @ojoaonetocp — marca Infomestre.
Criador: Joao Neto, infoprodutor brasileiro que ensina a criar e automatizar infoprodutos com IA.

${pilarContext}

REGRAS OBRIGATORIAS:
- Tudo em PORTUGUES BRASILEIRO (PT-BR) natural e conversacional
- Linguagem informal brasileira real (nao de Portugal)
- Sem cliches batidos
- Sem emojis excessivos (maximo 2-3 no total)

${contextBlock}

${isReel ? `Voce precisa gerar o conteudo para um REEL do Instagram:
- HOOK: A frase dos primeiros 3 segundos que para o scroll (1-2 linhas, impactante, curiosa)
- CORPO: O roteiro/script do Reel (8-15 linhas, desenvolvimento completo, passos ou argumentos claros)
- CTA: Chamada para acao no final (2-3 linhas, mandar seguir, salvar, comentar)
- CAPTION: Legenda do post (3-5 linhas com hashtags relevantes)` : `Voce precisa gerar o conteudo para um POST UNICO (single) do Instagram:
- HOOK: Frase impactante principal do post (1-2 linhas)
- CORPO: Texto de desenvolvimento (5-10 linhas)
- CTA: Chamada para acao (2-3 linhas)
- CAPTION: Legenda do post (3-5 linhas com hashtags relevantes)`}

Retorne JSON: { "hook": "...", "corpo": "...", "cta": "...", "caption": "..." }`;

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(500).json({ error: data.error?.message || 'Erro API Gemini' });

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');
    if (!text) return res.status(500).json({ error: 'Resposta vazia da IA' });

    try {
      const result = JSON.parse(text);
      console.log('generate-post-content OK:', Object.keys(result));
      res.json(result);
    } catch {
      // Try extracting JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        res.json(result);
      } else {
        res.status(500).json({ error: 'Resposta invalida da IA' });
      }
    }
  } catch (err) {
    console.error('generate-post-content error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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
      // Extract URL from topic if present (for react/noticias pilars)
      const urlMatch = input.match(/https?:\/\/[^\s)]+/);
      const newsUrl = urlMatch ? urlMatch[0] : '';
      const linkInstruction = newsUrl ? `\n\nIMPORTANTE: O link da noticia original e: ${newsUrl}\n- INCLUA este link no slide da noticia (slide 2)\n- INCLUA este link na caption\n- Formate: "Fonte: [Site] — ${newsUrl}"` : '';

      contextBlock = `O TEMA/ASSUNTO do post e: "${input}"
Baseado neste tema, voce precisa:
1. Criar um HOOK poderoso (a frase de capa que para o scroll) relacionado ao tema
2. Pesquisar/desenvolver o conteudo com base no tema descrito
3. Gerar o conteudo textual de cada slide

O hook deve ser curto (1-2 linhas), impactante, e fazer a pessoa querer ver o resto do carrossel.${linkInstruction}`;
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

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');
    console.log('generate-slides-content raw response length:', text.length);
    console.log('generate-slides-content first 500 chars:', text.substring(0, 500));
    if (!text) {
      console.error('generate-slides-content: empty response from Gemini');
      console.log('Gemini response:', JSON.stringify(data).substring(0, 1000));
      return res.status(500).json({ error: 'Resposta vazia da IA. Tente novamente.' });
    }
    try {
      const result = JSON.parse(text);
      console.log('generate-slides-content: parsed OK, slides:', result.slides?.length || 0);
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

    const enhancedPrompt = `${slide.image_prompt}. Professional, ultra-detailed, 4K quality background image. Slide ${i + 1} of Instagram carousel. Absolutely no text, no typography, no letters, no words in the image. No watermarks. Visual only.`;

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
        const filename = `${postId || Date.now()}-slide-${i + 1}-${Date.now()}.png`;
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
        const filename = `${postId || Date.now()}-slide-${i + 1}-${Date.now()}.png`;
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

// ── Export carousel as ZIP ────────────────────────────────────
const archiver = require('archiver');

app.get('/api/posts/:id/export-carousel', async (req, res) => {
  const post = db.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post nao encontrado' });
  if (!post.slides || post.slides.length === 0) return res.status(400).json({ error: 'Post sem slides' });

  const slidesWithImages = post.slides.filter(s => s.image_url);
  if (slidesWithImages.length === 0) return res.status(400).json({ error: 'Nenhum slide com imagem gerada' });

  const safeName = (post.hook || 'carrossel').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').substring(0, 40);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-carrossel.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  for (let i = 0; i < post.slides.length; i++) {
    const slide = post.slides[i];
    if (!slide.image_url) continue;
    const imgPath = path.join(__dirname, '..', 'data', slide.image_url.replace('/images/', 'images/'));
    if (fs.existsSync(imgPath)) {
      const label = slide.label.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').substring(0, 30);
      archive.file(imgPath, { name: `${String(i + 1).padStart(2, '0')}-${label}.png` });
    }
  }

  archive.finalize();
});

// ── Export to DOCX (Google Docs compatible) ─────────────────
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');

app.get('/api/posts/:id/export-doc', async (req, res) => {
  const post = db.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post nao encontrado' });

  const isReel = post.formato === 'reel';
  const pilarLabels = {
    'bastidores': 'Bastidores', 'sistemas': 'Sistemas', 'ia-aplicada': 'IA Aplicada',
    'provocacao': 'Provocacao', 'resultado': 'Resultado', 'noticias': 'Noticias', 'react': 'React'
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
