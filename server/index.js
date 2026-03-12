require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
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
  const { hook, caption, pilar, formato, status, scheduled_date, image_url, image_prompt, hashtags, notes } = req.body;
  if (!hook || !pilar || !formato) return res.status(400).json({ error: 'hook, pilar e formato são obrigatórios' });
  const post = db.insert({ hook, caption: caption || '', pilar, formato, status: status || 'rascunho', scheduled_date: scheduled_date || null, image_url: image_url || null, image_prompt: image_prompt || '', hashtags: hashtags || '', notes: notes || '' });
  res.status(201).json(post);
});

app.put('/api/posts/:id', (req, res) => {
  const post = db.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const fields = ['hook','caption','pilar','formato','status','scheduled_date','image_url','image_prompt','hashtags','notes'];
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

// ── Image generation (Nano Banana = Gemini Imagen) ────────
app.post('/api/generate-image', async (req, res) => {
  const { prompt, postId, aspectRatio = '9:16' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt obrigatório' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY não configurada. Acesse /admin/settings para configurar.' });

  try {
    const ai = new GoogleGenAI({ apiKey });

    const enhancedPrompt = `Instagram post image for Infomestre brand (Brazilian digital course creator). Brand palette: black background #0A0A0A, neon lime accent #CCFF00, white text #FFFFFF. Modern bold minimalist style. ${prompt}. High quality, vertical 9:16 format, Portuguese text if any. No watermarks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp-image-generation',
      contents: enhancedPrompt,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (!imagePart) return res.status(500).json({ error: 'Imagem não gerada pela API' });

    const imageData = Buffer.from(imagePart.inlineData.data, 'base64');
    const filename = `${postId || Date.now()}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), imageData);

    const imageUrl = `/images/${filename}`;
    if (postId) {
      db.update(postId, { image_url: imageUrl });
    }

    res.json({ url: imageUrl, filename });
  } catch (err) {
    console.error('Image generation error:', err.message);
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
