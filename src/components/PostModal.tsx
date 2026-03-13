import { useState, useEffect } from 'react';
import type { Post } from '../types';
import { api } from '../api';
import { PilarBadge, FormatoBadge } from './Badge';
import { STATUS_CYCLE, STATUS_CFG, PILARES, FORMATOS, PILAR_CFG, FORMATO_CFG } from './config';

interface Props {
  post: Post | null;
  onClose: () => void;
  onSave: (p: Post) => void;
  onDelete: (id: string) => void;
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

export function PostModal({ post, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Partial<Post>>({});
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

  useEffect(() => {
    if (post) setForm({ ...post });
  }, [post]);

  if (!post) return null;

  const isReel = (form.formato || post.formato) === 'reel';
  const set = (k: keyof Post, v: any) => setForm(f => ({ ...f, [k]: v }));

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
      <div className="rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
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

          {/* Left panel — only for non-Reel (image section) */}
          {!isReel && (
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
                  value={form.pilar || ''} onChange={e => set('pilar', e.target.value)}>
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
                {/* Hook */}
                <div className="rounded-lg p-4 space-y-1" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#CCFF00', color: '#0A0A0A' }}>1</span>
                    <label className="text-xs font-semibold" style={{ color: '#CCFF00' }}>Hook — primeiros 3 segundos</label>
                  </div>
                  <input type="text" className="w-full text-sm rounded-lg px-3 py-2 outline-none font-semibold"
                    style={{ background: '#0A0A0A', border: '1px solid #222', color: '#E5E5E5' }}
                    value={form.hook || ''} onChange={e => set('hook', e.target.value)}
                    placeholder="A frase que para o scroll..." />
                  <SectionRewriteBtn
                    section="hook" content={form.hook || ''}
                    context={buildContext('hook')}
                    formato={form.formato || post.formato}
                    onRewrite={text => set('hook', text)} />
                </div>

                {/* Corpo */}
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
                  <SectionRewriteBtn
                    section="corpo" content={form.corpo || ''}
                    context={buildContext('corpo')}
                    formato={form.formato || post.formato}
                    onRewrite={text => set('corpo', text)} />
                </div>

                {/* CTA */}
                <div className="rounded-lg p-4 space-y-1" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#CCFF00', color: '#0A0A0A' }}>3</span>
                    <label className="text-xs font-semibold" style={{ color: '#CCFF00' }}>CTA — chamada para acao</label>
                  </div>
                  <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                    style={{ background: '#0A0A0A', border: '1px solid #222', color: '#E5E5E5' }}
                    rows={3} value={form.cta || ''} onChange={e => set('cta', e.target.value)}
                    placeholder="Chamada para acao: seguir, salvar, comentar, clicar no link..." />
                  <SectionRewriteBtn
                    section="cta" content={form.cta || ''}
                    context={buildContext('cta')}
                    formato={form.formato || post.formato}
                    onRewrite={text => set('cta', text)} />
                </div>
              </>
            ) : (
              /* ═══ NON-REEL: Hook + Caption ═══ */
              <>
                <div>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>Hook (primeiros 3 segundos)</label>
                  <input type="text" className="w-full text-sm rounded-lg px-3 py-2 outline-none font-semibold"
                    style={inputStyle}
                    value={form.hook || ''} onChange={e => set('hook', e.target.value)}
                    placeholder="A frase que para o scroll..." />
                  <SectionRewriteBtn
                    section="hook" content={form.hook || ''}
                    context={buildContext('hook')}
                    formato={form.formato || post.formato}
                    onRewrite={text => set('hook', text)} />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>Caption completa</label>
                  <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                    style={inputStyle}
                    rows={8} value={form.caption || ''} onChange={e => set('caption', e.target.value)}
                    placeholder="Escreva a legenda completa do post..." />
                  <p className="text-xs mt-1 text-right" style={{ color: '#444' }}>{(form.caption || '').length} caracteres</p>
                  <SectionRewriteBtn
                    section="corpo" content={form.caption || ''}
                    context={buildContext('caption')}
                    formato={form.formato || post.formato}
                    onRewrite={text => set('caption', text)} />
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
                  const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
                  window.open(`${BASE}/api/posts/${post.id}/export-doc`, '_blank');
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
