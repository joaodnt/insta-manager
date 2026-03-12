import { useState, useEffect } from 'react';
import type { Post } from '../types';
import { api } from '../api';
import { StatusBadge, PilarBadge, FormatoBadge } from './Badge';
import { STATUS_CYCLE, PILARES, FORMATOS, PILAR_CFG, FORMATO_CFG } from './config';

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
  const [saved, setSaved] = useState(false);
  const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

  useEffect(() => {
    if (post) setForm({ ...post });
  }, [post]);

  if (!post) return null;

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
      alert('Erro: ' + err.message);
    } finally {
      setGenLoading(false);
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
              className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: image */}
          <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col">
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
                className="w-full bg-gray-900 text-white text-xs py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
                {genLoading ? 'Gerando com Nano Banana...' : imgSrc ? 'Gerar nova imagem' : 'Gerar imagem com IA'}
              </button>
            </div>
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
                  {STATUS_CYCLE.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Hook (primeiros 3 segundos)</label>
              <input type="text" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 font-semibold"
                value={form.hook || ''} onChange={e => set('hook', e.target.value)} placeholder="A frase que para o scroll..." />
            </div>

            {/* Caption */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Caption completa</label>
              <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 resize-none"
                rows={8} value={form.caption || ''} onChange={e => set('caption', e.target.value)}
                placeholder="Escreva a legenda completa do post..." />
              <p className="text-xs text-gray-400 mt-1 text-right">{(form.caption || '').length} caracteres</p>
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
                placeholder="Anotações sobre este post..." />
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
