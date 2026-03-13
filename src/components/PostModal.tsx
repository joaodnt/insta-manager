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

export function PostModal({ post, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Partial<Post>>({});
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [references, setReferences] = useState('');
  const [showRewrite, setShowRewrite] = useState(false);
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

  const rewriteCopy = async () => {
    setRewriteLoading(true);
    try {
      const result = await api.rewriteCopy({
        caption: form.caption || '',
        hook: form.hook || '',
        references,
        formato: form.formato || post.formato,
      });
      set('hook', result.hook);
      set('caption', result.caption);
      setForm(f => ({ ...f, hook: result.hook, caption: result.caption }));
    } catch (err: any) {
      alert('Erro ao reescrever: ' + err.message);
    } finally {
      setRewriteLoading(false);
    }
  };

  const imgSrc = form.image_url ? BASE + form.image_url : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <PilarBadge pilar={form.pilar as any || post.pilar} />
            <FormatoBadge formato={form.formato as any || post.formato} />
            {form.scheduled_date && (
              <span className="text-sm text-gray-500">
                {new Date(form.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs text-green-600 font-medium">Salvo</span>}
            <button onClick={save} disabled={loading}
              className="text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#0A0A0A', color: '#CCFF00' }}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">&#10005;</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel */}
          <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col">
            {isReel ? (
              /* ── REEL: video section ── */
              <div className="flex-1 flex flex-col">
                <div className="flex-1 bg-gray-50 relative overflow-hidden flex flex-col items-center justify-center p-4">
                  {form.video_url ? (
                    <div className="w-full text-center space-y-2">
                      <div className="w-16 h-16 mx-auto bg-gray-900 rounded-full flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#CCFF00"><polygon points="5 3 19 12 5 21" /></svg>
                      </div>
                      <p className="text-xs text-gray-600 break-all">{form.video_url}</p>
                    </div>
                  ) : (
                    <div className="text-center space-y-3 text-gray-300">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <polygon points="10 8 16 12 10 16" fill="currentColor" opacity="0.3" />
                      </svg>
                      <span className="text-xs text-gray-400 block">Nenhum video vinculado</span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <input type="text"
                    className="w-full text-xs border border-gray-200 rounded p-2 outline-none focus:border-gray-400 text-gray-700"
                    placeholder="URL do video (Drive, YouTube, etc)..."
                    value={form.video_url || ''}
                    onChange={e => set('video_url', e.target.value)} />
                  <p className="text-[10px] text-gray-400">Cole o link do video finalizado</p>
                </div>
              </div>
            ) : (
              /* ── IMAGE section (carrossel / single) ── */
              <>
                <div className="flex-1 bg-gray-50 relative overflow-hidden">
                  {imgSrc ? (
                    <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-300 p-6 text-center">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span className="text-xs text-gray-400">Nenhuma imagem gerada ainda</span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <textarea className="w-full text-xs border border-gray-200 rounded p-2 resize-none outline-none focus:border-gray-400 text-gray-700"
                    rows={3} placeholder="Prompt para gerar a imagem..." value={form.image_prompt || ''}
                    onChange={e => set('image_prompt', e.target.value)} />
                  <button onClick={genImage} disabled={genLoading}
                    className="w-full text-xs py-2 rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: '#0A0A0A', color: '#CCFF00' }}>
                    {genLoading ? 'Gerando com IA...' : imgSrc ? 'Gerar nova imagem' : 'Gerar imagem com IA'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right: form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Meta row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pilar</label>
                <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                  value={form.pilar || ''} onChange={e => set('pilar', e.target.value)}>
                  {PILARES.map(p => <option key={p} value={p}>{PILAR_CFG[p].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Formato</label>
                <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                  value={form.formato || ''} onChange={e => set('formato', e.target.value)}>
                  {FORMATOS.map(f => <option key={f} value={f}>{FORMATO_CFG[f].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                  value={form.status || ''} onChange={e => set('status', e.target.value as any)}>
                  {STATUS_CYCLE.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data agendada</label>
              <input type="date" className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                value={form.scheduled_date || ''} onChange={e => set('scheduled_date', e.target.value)} />
            </div>

            {/* Hook */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {isReel ? 'Hook do Reel (primeiros 3 seg)' : 'Hook (primeiros 3 segundos)'}
              </label>
              <input type="text" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 font-semibold"
                value={form.hook || ''} onChange={e => set('hook', e.target.value)} placeholder="A frase que para o scroll..." />
            </div>

            {/* Caption / Script */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {isReel ? 'Script / Copy do Reel' : 'Caption completa'}
              </label>
              <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 resize-none"
                rows={isReel ? 10 : 8} value={form.caption || ''} onChange={e => set('caption', e.target.value)}
                placeholder={isReel ? 'Escreva o roteiro falado do Reel...' : 'Escreva a legenda completa do post...'} />
              <p className="text-xs text-gray-400 mt-1 text-right">{(form.caption || '').length} caracteres</p>
            </div>

            {/* AI Rewrite Section */}
            <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-3" style={{ borderColor: showRewrite ? '#CCFF00' : undefined }}>
              <button onClick={() => setShowRewrite(!showRewrite)}
                className="flex items-center gap-2 text-xs font-medium w-full"
                style={{ color: '#5A7000' }}>
                <span style={{ background: '#CCFF00', color: '#0A0A0A', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 700 }}>IA</span>
                {showRewrite ? 'Fechar reescrita com IA' : 'Reescrever copy com IA'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: showRewrite ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showRewrite && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Referencias (cole copys de outros criadores como inspiracao)
                    </label>
                    <textarea
                      className="w-full text-xs border border-gray-200 rounded p-2 resize-none outline-none focus:border-gray-400 text-gray-600"
                      rows={5}
                      value={references}
                      onChange={e => setReferences(e.target.value)}
                      placeholder={"Cole aqui copys de referencia de outros criadores...\nEx: @fulano: \"Texto da copy dele...\"\n@ciclano: \"Outro exemplo de copy...\""}
                    />
                  </div>
                  <button onClick={rewriteCopy} disabled={rewriteLoading || (!form.caption && !form.hook)}
                    className="w-full text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50 font-semibold"
                    style={{ background: '#0A0A0A', color: '#CCFF00' }}>
                    {rewriteLoading ? 'Reescrevendo com IA...' : 'Reescrever Hook + Copy com IA'}
                  </button>
                  <p className="text-[10px] text-gray-400">
                    A IA vai reescrever mantendo a ideia, melhorando hook e CTA. As referencias servem de inspiracao de tom.
                  </p>
                </div>
              )}
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hashtags</label>
              <input type="text" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                value={form.hashtags || ''} onChange={e => set('hashtags', e.target.value)} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas internas</label>
              <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 resize-none text-gray-500"
                rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
                placeholder="Anotacoes sobre este post..." />
            </div>

            {/* Delete */}
            <div className="pt-2 border-t border-gray-100">
              <button onClick={() => { if (confirm('Excluir post?')) { onDelete(post.id); onClose(); } }}
                className="text-xs text-red-400 hover:text-red-600 transition-colors">
                Excluir este post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
