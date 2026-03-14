import { useState, useEffect } from 'react';
import type { Post, Slide } from '../types';
import { api } from '../api';
import { PilarBadge, FormatoBadge } from './Badge';
import { STATUS_CYCLE, STATUS_CFG, PILARES, FORMATOS, PILAR_CFG, FORMATO_CFG, PILAR_SLIDE_PRESETS } from './config';

interface Props {
  post: Post | null;
  onClose: () => void;
  onSave: (p: Post) => void;
  onDelete: (id: string) => void;
}

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', desc: 'Quadrado' },
  { label: '4:5', value: '4:5', desc: 'Retrato' },
  { label: '3:4', value: '3:4', desc: 'Retrato alt' },
  { label: '9:16', value: '9:16', desc: 'Story/Reel' },
  { label: '16:9', value: '16:9', desc: 'Paisagem' },
];

// Helper: get default slides for a pilar
function getDefaultSlidesForPilar(pilar: string): { label: string; content: string; image_prompt: string; image_url: string | null }[] {
  const presets = PILAR_SLIDE_PRESETS[pilar as keyof typeof PILAR_SLIDE_PRESETS];
  if (!presets) {
    // Fallback generic
    return [
      { label: 'Hook — capa que para o scroll', content: '', image_prompt: '', image_url: null },
      { label: 'Problema — dor do publico', content: '', image_prompt: '', image_url: null },
      { label: 'Solucao', content: '', image_prompt: '', image_url: null },
      { label: 'CTA — chamada para acao', content: '', image_prompt: '', image_url: null },
    ];
  }
  return presets.map(p => ({ label: p.label, content: '', image_prompt: '', image_url: null }));
}

function SectionRewriteBtn({ section, content, context, formato, onRewrite }: {
  section: string; content: string; context?: string; formato: string;
  onRewrite: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [refs, setRefs] = useState('');
  const [showRefs, setShowRefs] = useState(false);

  const rewrite = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const result = await api.rewriteSection({ section, content, context, references: refs, formato });
      onRewrite(result.rewritten);
    } catch (err: any) {
      alert('Erro ao reescrever: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={rewrite} disabled={loading || !content.trim()}
          className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all disabled:opacity-30 flex items-center gap-1.5"
          style={{ background: '#CCFF00', color: '#0A0A0A' }}>
          <span style={{ fontSize: '9px', fontWeight: 800, background: '#0A0A0A', color: '#CCFF00', borderRadius: '3px', padding: '1px 4px' }}>IA</span>
          {loading ? 'Reescrevendo...' : 'Reescrever'}
        </button>
        <button onClick={() => setShowRefs(!showRefs)}
          className="text-xs px-2 py-1.5 rounded-md transition-colors"
          style={{ color: '#666', border: '1px solid #222' }}>
          {showRefs ? 'Fechar refs' : '+ Refs'}
        </button>
      </div>
      {showRefs && (
        <textarea
          className="w-full text-xs rounded-md p-2 resize-none outline-none"
          style={{ background: '#111', border: '1px solid #222', color: '#999' }}
          rows={3} value={refs} onChange={e => setRefs(e.target.value)}
          placeholder="Cole copys de referencia como inspiracao..." />
      )}
    </div>
  );
}

// ── Slide editor for Carousel ──────────────────────────────
function SlideEditor({ slide, index, total, formato, onUpdate, onRemove, onMoveUp, onMoveDown, postId, allSlides }: {
  slide: Slide; index: number; total: number; formato: string;
  onUpdate: (s: Slide) => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void; postId: string;
  allSlides?: { label: string; content: string }[];
}) {
  const [promptLoading, setPromptLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
  const imgSrc = slide.image_url ? BASE + slide.image_url : null;

  const generatePrompt = async () => {
    if (!slide.content.trim()) return alert('Escreva o conteudo do slide primeiro.');
    setPromptLoading(true);
    try {
      const { prompt } = await api.generatePrompt({
        slideLabel: slide.label,
        slideContent: slide.content,
        formato,
        slideIndex: index,
        allSlides: allSlides,
      });
      onUpdate({ ...slide, image_prompt: prompt });
    } catch (err: any) {
      alert('Erro ao gerar prompt: ' + err.message);
    } finally {
      setPromptLoading(false);
    }
  };

  const generateImage = async () => {
    if (!slide.image_prompt.trim()) return alert('Gere ou escreva um prompt primeiro.');
    setImgLoading(true);
    try {
      const { url } = await api.generateImage(slide.image_prompt, `${postId}-slide-${index + 1}-${Date.now()}`, aspectRatio);
      onUpdate({ ...slide, image_url: url });
    } catch (err: any) {
      alert('Erro ao gerar imagem: ' + err.message);
    } finally {
      setImgLoading(false);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
      {/* Slide header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#CCFF00', color: '#0A0A0A' }}>{index + 1}</span>
        <input type="text" className="flex-1 text-xs font-semibold bg-transparent outline-none"
          style={{ color: '#CCFF00' }}
          value={slide.label} onChange={e => onUpdate({ ...slide, label: e.target.value })}
          placeholder="Nome do slide..." />
        <div className="flex items-center gap-1">
          {index > 0 && (
            <button onClick={onMoveUp} className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ color: '#666' }} title="Mover para cima">↑</button>
          )}
          {index < total - 1 && (
            <button onClick={onMoveDown} className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ color: '#666' }} title="Mover para baixo">↓</button>
          )}
          {total > 1 && (
            <button onClick={onRemove} className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ color: '#EF4444' }} title="Remover slide">✕</button>
          )}
        </div>
      </div>

      <div className="flex">
        {/* Left: image preview */}
        <div className="w-40 shrink-0 flex flex-col" style={{ borderRight: '1px solid #1A1A1A' }}>
          <div className="relative" style={{ background: '#0A0A0A', aspectRatio: '1/1' }}>
            {imgSrc ? (
              <img src={imgSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span className="text-xs text-center" style={{ color: '#333', fontSize: '9px' }}>Sem imagem</span>
              </div>
            )}
          </div>
          {/* Aspect ratio selector */}
          <div className="p-2 flex flex-wrap gap-1 justify-center">
            {ASPECT_RATIOS.map(ar => (
              <button key={ar.value} onClick={() => setAspectRatio(ar.value)}
                className="text-xs px-1.5 py-0.5 rounded transition-colors"
                style={aspectRatio === ar.value
                  ? { background: '#CCFF00', color: '#0A0A0A', fontSize: '9px', fontWeight: 600 }
                  : { color: '#555', border: '1px solid #222', fontSize: '9px' }}>
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: content + prompt */}
        <div className="flex-1 p-3 space-y-2">
          {/* Content */}
          <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
            style={{ background: '#0A0A0A', border: '1px solid #222', color: '#E5E5E5' }}
            rows={3} value={slide.content} onChange={e => onUpdate({ ...slide, content: e.target.value })}
            placeholder="Conteudo do slide..." />

          <SectionRewriteBtn
            section="corpo" content={slide.content}
            formato={formato}
            onRewrite={text => onUpdate({ ...slide, content: text })} />

          {/* Prompt area */}
          <div className="space-y-1.5" style={{ borderTop: '1px solid #1A1A1A', paddingTop: '8px' }}>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: '#666' }}>Prompt da imagem</label>
              <button onClick={generatePrompt} disabled={promptLoading}
                className="text-xs px-2 py-1 rounded-md font-semibold transition-all disabled:opacity-30 flex items-center gap-1"
                style={{ background: '#1A1A1A', color: '#CCFF00', border: '1px solid #333' }}>
                <span style={{ fontSize: '8px', fontWeight: 800 }}>IA</span>
                {promptLoading ? 'Gerando...' : 'Gerar prompt'}
              </button>
            </div>
            <textarea className="w-full text-xs rounded p-2 resize-none outline-none"
              style={{ background: '#0A0A0A', border: '1px solid #222', color: '#999' }}
              rows={2} value={slide.image_prompt}
              onChange={e => onUpdate({ ...slide, image_prompt: e.target.value })}
              placeholder="Prompt para gerar a imagem deste slide..." />
            <button onClick={generateImage} disabled={imgLoading || !slide.image_prompt.trim()}
              className="w-full text-xs py-1.5 rounded-lg transition-colors disabled:opacity-30 font-semibold"
              style={{ background: '#CCFF00', color: '#0A0A0A' }}>
              {imgLoading ? 'Gerando imagem...' : imgSrc ? 'Regerar imagem' : 'Gerar imagem'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostModal({ post, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Partial<Post>>({});
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [contentGenLoading, setContentGenLoading] = useState(false);
  const [batchAspect, setBatchAspect] = useState('1:1');
  const [saved, setSaved] = useState(false);
  const [autoGenTriggered, setAutoGenTriggered] = useState(false);
  const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

  // Auto-generate content for new carousel posts
  const generateSlidesContent = async (pilar: string, topicOrHook: string, currentSlides: Slide[], formato: string, isTopicBased = false) => {
    setContentGenLoading(true);
    try {
      const payload: any = {
        pilar,
        slides: currentSlides.map(s => ({ label: s.label })),
        formato,
      };
      // Send as topic (AI generates hook + idea) or as hook (legacy)
      if (isTopicBased) {
        payload.topic = topicOrHook; // can be empty string = auto-idea mode
      } else {
        payload.hook = topicOrHook;
      }
      const { hook: generatedHook, caption, slides: generated } = await api.generateSlidesContent(payload);
      if (!generated || generated.length === 0) {
        alert('A IA nao retornou conteudo. Clique em "Gerar conteudo" para tentar novamente.');
        return;
      }
      // Merge generated content into slides — use INDEX-based matching (more reliable than label matching)
      const next = currentSlides.map((slide, i) => {
        // Try index first, then fallback to label match
        const match = generated[i] || generated.find(g => g.label === slide.label);
        return match ? { ...slide, content: match.content } : slide;
      });
      // Update hook and caption from AI
      const updates: Partial<Post> = { slides: next };
      if (generatedHook) {
        updates.hook = generatedHook;
      }
      if (caption) {
        updates.caption = caption;
      }
      setForm(f => ({ ...f, ...updates }));
    } catch (err: any) {
      console.error('Erro ao gerar conteudo:', err.message);
      alert('Erro ao gerar conteudo: ' + (err.message || 'Tente novamente'));
    } finally {
      setContentGenLoading(false);
    }
  };

  useEffect(() => {
    if (post) {
      const p = { ...post };
      let shouldAutoGen = false;
      // Initialize slides for carousel if empty — use pilar-specific presets
      if (p.formato === 'carrossel' && (!p.slides || p.slides.length === 0)) {
        const defaultSlides = getDefaultSlidesForPilar(p.pilar);
        p.slides = defaultSlides;
        // Always auto-generate for new carousel posts (with or without hook)
        shouldAutoGen = true;
      }
      setForm(p);
      setAutoGenTriggered(false);
      if (shouldAutoGen) {
        setTimeout(() => setAutoGenTriggered(true), 100);
      }
    }
  }, [post]);

  // Auto-generate content when triggered
  useEffect(() => {
    if (autoGenTriggered && form.pilar && form.slides && form.slides.length > 0) {
      const topicOrHook = form.hook || '';
      const isTopicBased = true; // always generate hook for new posts
      generateSlidesContent(form.pilar, topicOrHook, form.slides as Slide[], form.formato || 'carrossel', isTopicBased);
      setAutoGenTriggered(false);
    }
  }, [autoGenTriggered]);

  if (!post) return null;

  const isReel = (form.formato || post.formato) === 'reel';
  const isCarrossel = (form.formato || post.formato) === 'carrossel';
  const set = (k: keyof Post, v: any) => setForm(f => ({ ...f, [k]: v }));

  const slides: Slide[] = form.slides || [];
  const setSlides = (newSlides: Slide[]) => set('slides', newSlides);
  const updateSlide = (i: number, s: Slide) => {
    const next = [...slides];
    next[i] = s;
    setSlides(next);
  };
  const removeSlide = (i: number) => setSlides(slides.filter((_, idx) => idx !== i));
  const addSlide = () => {
    const pilar = (form.pilar || post.pilar) as string;
    const presets = PILAR_SLIDE_PRESETS[pilar as keyof typeof PILAR_SLIDE_PRESETS];
    const usedLabels = new Set(slides.map(s => s.label));
    const nextLabel = presets?.find(p => !usedLabels.has(p.label))?.label || `Slide ${slides.length + 1}`;
    setSlides([...slides, { label: nextLabel, content: '', image_prompt: '', image_url: null }]);
  };

  // Reset slides when pilar changes (only if carousel and slides are still empty/default)
  const handlePilarChange = (newPilar: string) => {
    set('pilar', newPilar);
    if ((form.formato || post.formato) === 'carrossel') {
      const hasContent = slides.some(s => s.content.trim() || s.image_url);
      if (!hasContent) {
        set('slides', getDefaultSlidesForPilar(newPilar));
      }
    }
  };
  const moveSlide = (from: number, dir: number) => {
    const next = [...slides];
    const to = from + dir;
    [next[from], next[to]] = [next[to], next[from]];
    setSlides(next);
  };

  const save = async () => {
    setLoading(true);
    try {
      const updated = await api.updatePost(post.id, form);
      onSave(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const genImage = async () => {
    if (!form.image_prompt) return alert('Defina um prompt de imagem primeiro.');
    setGenLoading(true);
    try {
      const { url } = await api.generateImage(form.image_prompt!, post.id);
      set('image_url', url);
      onSave({ ...post, ...form, image_url: url });
    } catch (err: any) {
      alert('Erro ao gerar imagem: ' + err.message);
    } finally {
      setGenLoading(false);
    }
  };

  // Batch generate all slide images
  const batchGenerate = async () => {
    const slidesWithPrompt = slides.filter(s => s.image_prompt.trim());
    if (slidesWithPrompt.length === 0) return alert('Gere os prompts dos slides primeiro.');
    setBatchLoading(true);
    try {
      const { results } = await api.generateSlidesImages({
        postId: post.id,
        slides,
        aspectRatio: batchAspect,
      });
      const next = [...slides];
      for (const r of results) {
        if (r.url && next[r.index]) {
          next[r.index] = { ...next[r.index], image_url: r.url };
        }
      }
      setSlides(next);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        alert(`${results.length - errors.length} imagens geradas. ${errors.length} com erro.`);
      }
    } catch (err: any) {
      alert('Erro na geracao em lote: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  // Generate all prompts with AI
  const batchGenPrompts = async () => {
    const slidesWithContent = slides.filter(s => s.content.trim());
    if (slidesWithContent.length === 0) return alert('Escreva o conteudo dos slides primeiro.');
    setBatchLoading(true);
    try {
      const next = [...slides];
      const allSlidesCtx = next.map(s => ({ label: s.label, content: s.content }));
      for (let i = 0; i < next.length; i++) {
        if (!next[i].content.trim()) continue;
        try {
          const { prompt } = await api.generatePrompt({
            slideLabel: next[i].label,
            slideContent: next[i].content,
            formato: form.formato || post.formato,
            slideIndex: i,
            allSlides: allSlidesCtx,
          });
          next[i] = { ...next[i], image_prompt: prompt };
        } catch { /* skip failed */ }
      }
      setSlides(next);
    } catch (err: any) {
      alert('Erro ao gerar prompts: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const imgSrc = form.image_url ? BASE + form.image_url : null;

  // Build context string for AI section rewrite
  const buildContext = (excluding: string) => {
    const parts: string[] = [];
    if (excluding !== 'hook' && form.hook) parts.push(`Hook: ${form.hook}`);
    if (excluding !== 'corpo' && form.corpo) parts.push(`Corpo: ${form.corpo}`);
    if (excluding !== 'cta' && form.cta) parts.push(`CTA: ${form.cta}`);
    if (excluding !== 'caption' && form.caption) parts.push(`Caption: ${form.caption}`);
    return parts.join('\n');
  };

  const inputStyle = { background: '#111', border: '1px solid #222', color: '#E5E5E5' };
  const labelStyle = { color: '#888' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className={`rounded-xl shadow-2xl w-full ${isCarrossel ? 'max-w-5xl' : 'max-w-4xl'} max-h-[92vh] overflow-hidden flex flex-col`}
        style={{ background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
          <div className="flex items-center gap-3">
            <PilarBadge pilar={form.pilar as any || post.pilar} />
            <FormatoBadge formato={form.formato as any || post.formato} />
            {form.scheduled_date && (
              <span className="text-sm" style={{ color: '#666' }}>
                {new Date(form.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs font-medium" style={{ color: '#CCFF00' }}>Salvo</span>}
            <button onClick={save} disabled={loading}
              className="text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 font-semibold"
              style={{ background: '#CCFF00', color: '#0A0A0A' }}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onClose} className="transition-colors text-xl leading-none" style={{ color: '#666' }}>&#10005;</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel — only for single post (image section) */}
          {!isReel && !isCarrossel && (
            <div className="w-72 shrink-0 flex flex-col" style={{ borderRight: '1px solid #1A1A1A' }}>
              <div className="flex-1 relative overflow-hidden" style={{ background: '#0A0A0A' }}>
                {imgSrc ? (
                  <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.2">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span className="text-xs" style={{ color: '#444' }}>Nenhuma imagem gerada ainda</span>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <textarea className="w-full text-xs rounded p-2 resize-none outline-none"
                  style={inputStyle}
                  rows={3} placeholder="Prompt para gerar a imagem..." value={form.image_prompt || ''}
                  onChange={e => set('image_prompt', e.target.value)} />
                <button onClick={genImage} disabled={genLoading}
                  className="w-full text-xs py-2 rounded-lg transition-colors disabled:opacity-50 font-semibold"
                  style={{ background: '#CCFF00', color: '#0A0A0A' }}>
                  {genLoading ? 'Gerando com IA...' : imgSrc ? 'Gerar nova imagem' : 'Gerar imagem com IA'}
                </button>
              </div>
            </div>
          )}

          {/* Right: form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Meta row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Pilar</label>
                <select className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                  style={inputStyle}
                  value={form.pilar || ''} onChange={e => handlePilarChange(e.target.value)}>
                  {PILARES.map(p => <option key={p} value={p}>{PILAR_CFG[p].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Formato</label>
                <select className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                  style={inputStyle}
                  value={form.formato || ''} onChange={e => set('formato', e.target.value)}>
                  {FORMATOS.map(f => <option key={f} value={f}>{FORMATO_CFG[f].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Status</label>
                <select className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                  style={inputStyle}
                  value={form.status || ''} onChange={e => set('status', e.target.value as any)}>
                  {STATUS_CYCLE.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Data agendada</label>
                <input type="date" className="text-sm rounded-lg px-3 py-2 outline-none w-full"
                  style={inputStyle}
                  value={form.scheduled_date || ''} onChange={e => set('scheduled_date', e.target.value)} />
              </div>
              {isReel && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>URL do Video</label>
                  <input type="text" className="text-sm rounded-lg px-3 py-2 outline-none w-full"
                    style={inputStyle}
                    placeholder="Link do video (Drive, YouTube...)"
                    value={form.video_url || ''} onChange={e => set('video_url', e.target.value)} />
                </div>
              )}
            </div>

            {isReel ? (
              /* ═══ REEL: 3 script sections ═══ */
              <>
                <div className="rounded-lg p-4 space-y-1" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#CCFF00', color: '#0A0A0A' }}>1</span>
                    <label className="text-xs font-semibold" style={{ color: '#CCFF00' }}>Hook — primeiros 3 segundos</label>
                  </div>
                  <input type="text" className="w-full text-sm rounded-lg px-3 py-2 outline-none font-semibold"
                    style={{ background: '#0A0A0A', border: '1px solid #222', color: '#E5E5E5' }}
                    value={form.hook || ''} onChange={e => set('hook', e.target.value)}
                    placeholder="A frase que para o scroll..." />
                  <SectionRewriteBtn section="hook" content={form.hook || ''} context={buildContext('hook')} formato={form.formato || post.formato} onRewrite={text => set('hook', text)} />
                </div>
                <div className="rounded-lg p-4 space-y-1" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#CCFF00', color: '#0A0A0A' }}>2</span>
                    <label className="text-xs font-semibold" style={{ color: '#CCFF00' }}>Corpo — desenvolvimento do script</label>
                  </div>
                  <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                    style={{ background: '#0A0A0A', border: '1px solid #222', color: '#E5E5E5' }}
                    rows={8} value={form.corpo || ''} onChange={e => set('corpo', e.target.value)}
                    placeholder="Desenvolva o conteudo principal do Reel..." />
                  <p className="text-xs text-right" style={{ color: '#444' }}>{(form.corpo || '').length} caracteres</p>
                  <SectionRewriteBtn section="corpo" content={form.corpo || ''} context={buildContext('corpo')} formato={form.formato || post.formato} onRewrite={text => set('corpo', text)} />
                </div>
                <div className="rounded-lg p-4 space-y-1" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#CCFF00', color: '#0A0A0A' }}>3</span>
                    <label className="text-xs font-semibold" style={{ color: '#CCFF00' }}>CTA — chamada para acao</label>
                  </div>
                  <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                    style={{ background: '#0A0A0A', border: '1px solid #222', color: '#E5E5E5' }}
                    rows={3} value={form.cta || ''} onChange={e => set('cta', e.target.value)}
                    placeholder="Chamada para acao: seguir, salvar, comentar, clicar no link..." />
                  <SectionRewriteBtn section="cta" content={form.cta || ''} context={buildContext('cta')} formato={form.formato || post.formato} onRewrite={text => set('cta', text)} />
                </div>
              </>
            ) : isCarrossel ? (
              /* ═══ CARROSSEL: Slide-by-slide editor ═══ */
              <>
                {/* Batch actions bar */}
                <div className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: '#CCFF00' }}>
                      {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
                    </span>
                    <span style={{ color: '#333' }}>|</span>
                    <span className="text-xs" style={{ color: '#666' }}>Aspecto:</span>
                    {ASPECT_RATIOS.map(ar => (
                      <button key={ar.value} onClick={() => setBatchAspect(ar.value)}
                        className="text-xs px-2 py-0.5 rounded transition-colors"
                        style={batchAspect === ar.value
                          ? { background: '#CCFF00', color: '#0A0A0A', fontWeight: 600 }
                          : { color: '#555', border: '1px solid #222' }}>
                        {ar.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => generateSlidesContent(form.pilar || post.pilar, form.hook || post.hook, slides, form.formato || post.formato, true)}
                      disabled={contentGenLoading || batchLoading}
                      className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all disabled:opacity-30 flex items-center gap-1.5"
                      style={{ background: '#CCFF00', color: '#0A0A0A' }}>
                      <span style={{ fontSize: '8px', fontWeight: 800, background: '#0A0A0A', color: '#CCFF00', borderRadius: '3px', padding: '1px 4px' }}>IA</span>
                      {contentGenLoading ? 'Gerando textos...' : 'Gerar conteudo'}
                    </button>
                    <button onClick={batchGenPrompts} disabled={batchLoading || contentGenLoading}
                      className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all disabled:opacity-30 flex items-center gap-1.5"
                      style={{ background: '#1A1A1A', color: '#CCFF00', border: '1px solid #333' }}>
                      <span style={{ fontSize: '8px', fontWeight: 800 }}>IA</span>
                      {batchLoading ? 'Gerando...' : 'Gerar prompts'}
                    </button>
                    <button onClick={batchGenerate} disabled={batchLoading || contentGenLoading}
                      className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all disabled:opacity-30 flex items-center gap-1.5"
                      style={{ background: '#1A1A1A', color: '#CCFF00', border: '1px solid #333' }}>
                      {batchLoading ? 'Gerando...' : 'Gerar todas imagens'}
                    </button>
                    {slides.some(s => s.image_url) && (
                      <a href={api.exportCarouselUrl(post.id)} download
                        className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 no-underline"
                        style={{ background: '#16A34A', color: '#FFF' }}
                        onClick={async (e) => {
                          e.preventDefault();
                          // Save first to ensure slides are persisted
                          await api.updatePost(post.id, form);
                          window.open(api.exportCarouselUrl(post.id), '_blank');
                        }}>
                        📥 Exportar ZIP
                      </a>
                    )}
                  </div>
                </div>

                {/* Content generation loading overlay */}
                {contentGenLoading && (
                  <div className="rounded-lg p-4 text-center space-y-2" style={{ background: '#111', border: '1px solid #CCFF0033' }}>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#CCFF00' }} />
                      <span className="text-sm font-semibold" style={{ color: '#CCFF00' }}>Gerando conteudo com IA...</span>
                    </div>
                    <p className="text-xs" style={{ color: '#666' }}>
                      A IA esta escrevendo o conteudo de cada slide baseado no pilar "{PILAR_CFG[(form.pilar || post.pilar) as keyof typeof PILAR_CFG]?.label}" e no hook do post.
                    </p>
                  </div>
                )}

                {/* Slides */}
                <div className="space-y-3">
                  {slides.map((slide, i) => (
                    <SlideEditor
                      key={i} slide={slide} index={i} total={slides.length}
                      formato={form.formato || post.formato}
                      postId={post.id}
                      allSlides={slides.map(s => ({ label: s.label, content: s.content }))}
                      onUpdate={s => updateSlide(i, s)}
                      onRemove={() => removeSlide(i)}
                      onMoveUp={() => moveSlide(i, -1)}
                      onMoveDown={() => moveSlide(i, 1)}
                    />
                  ))}
                </div>

                {/* Add slide button */}
                <button onClick={addSlide}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  style={{ border: '2px dashed #333', color: '#666' }}>
                  + Adicionar slide
                </button>

                {/* Caption (legenda do carrossel) */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>Legenda do carrossel</label>
                  <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                    style={inputStyle}
                    rows={4} value={form.caption || ''} onChange={e => set('caption', e.target.value)}
                    placeholder="Legenda que acompanha o carrossel no feed..." />
                  <SectionRewriteBtn section="corpo" content={form.caption || ''} context={buildContext('caption')} formato={form.formato || post.formato} onRewrite={text => set('caption', text)} />
                </div>
              </>
            ) : (
              /* ═══ SINGLE: Hook + Caption ═══ */
              <>
                <div>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>Hook</label>
                  <input type="text" className="w-full text-sm rounded-lg px-3 py-2 outline-none font-semibold"
                    style={inputStyle}
                    value={form.hook || ''} onChange={e => set('hook', e.target.value)}
                    placeholder="A frase que para o scroll..." />
                  <SectionRewriteBtn section="hook" content={form.hook || ''} context={buildContext('hook')} formato={form.formato || post.formato} onRewrite={text => set('hook', text)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>Caption completa</label>
                  <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                    style={inputStyle}
                    rows={8} value={form.caption || ''} onChange={e => set('caption', e.target.value)}
                    placeholder="Escreva a legenda completa do post..." />
                  <p className="text-xs mt-1 text-right" style={{ color: '#444' }}>{(form.caption || '').length} caracteres</p>
                  <SectionRewriteBtn section="corpo" content={form.caption || ''} context={buildContext('caption')} formato={form.formato || post.formato} onRewrite={text => set('caption', text)} />
                </div>
              </>
            )}

            {/* Hashtags */}
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Hashtags</label>
              <input type="text" className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={inputStyle}
                value={form.hashtags || ''} onChange={e => set('hashtags', e.target.value)} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Notas internas</label>
              <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                style={{ ...inputStyle, color: '#999' }}
                rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
                placeholder="Anotacoes sobre este post..." />
            </div>

            {/* Export + Delete */}
            <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #1A1A1A' }}>
              <button
                onClick={() => {
                  const B = import.meta.env.DEV ? 'http://localhost:3001' : '';
                  window.open(`${B}/api/posts/${post.id}/export-doc`, '_blank');
                }}
                className="text-xs px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 hover:opacity-90"
                style={{ background: '#CCFF00', color: '#0A0A0A' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Exportar para Google Docs
              </button>
              <button onClick={() => { if (confirm('Excluir post?')) { onDelete(post.id); onClose(); } }}
                className="text-xs transition-colors" style={{ color: '#EF4444' }}>
                Excluir este post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
