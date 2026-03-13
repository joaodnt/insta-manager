import { useState } from 'react';
import type { Post } from '../types';
import { StatusBadge, PilarBadge, FormatoBadge } from './Badge';
import { STATUS_CYCLE } from './config';
import { api } from '../api';

interface Props {
  post: Post;
  onUpdate: (p: Post) => void;
  onDelete: (id: string) => void;
  onOpen: (p: Post) => void;
}

export function PostCard({ post, onUpdate, onDelete, onOpen }: Props) {
  const [loading, setLoading] = useState(false);
  const isReel = post.formato === 'reel';

  const nextStatus = () => {
    const idx = STATUS_CYCLE.indexOf(post.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    api.updatePost(post.id, { status: next }).then(onUpdate);
  };

  const genImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.image_prompt) return;
    setLoading(true);
    try {
      const { url } = await api.generateImage(post.image_prompt, post.id);
      onUpdate({ ...post, image_url: url });
    } catch (err: any) {
      alert('Erro ao gerar imagem: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
  const imgSrc = post.image_url ? BASE + post.image_url : null;

  return (
    <div className="rounded-lg overflow-hidden hover:ring-1 hover:ring-[#CCFF00]/30 transition-all cursor-pointer group relative"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
      onClick={() => onOpen(post)}>

      {/* Image area — only for non-Reel formats */}
      {!isReel ? (
        <div className="relative overflow-hidden" style={{ background: '#0A0A0A', aspectRatio: '4/5' }}>
          {imgSrc ? (
            <img src={imgSrc} alt={post.hook} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span className="text-xs" style={{ color: '#444' }}>Sem imagem</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onClick={genImage} disabled={loading}
              className="text-xs px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
              style={{ background: '#CCFF00', color: '#0A0A0A' }}
              title="Gerar imagem com IA">
              {loading ? 'Gerando...' : imgSrc ? 'Gerar nova' : 'Gerar imagem'}
            </button>
          </div>
          <div className="absolute top-2 right-2">
            <FormatoBadge formato={post.formato} />
          </div>
        </div>
      ) : (
        /* Reel: compact header with format badge only */
        <div className="relative px-3 pt-3 pb-1 flex items-center justify-between" style={{ background: '#0A0A0A' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#CCFF00' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#0A0A0A"><polygon points="6 3 20 12 6 21" /></svg>
            </div>
            <span className="text-xs font-semibold" style={{ color: '#CCFF00' }}>Reel</span>
          </div>
          <FormatoBadge formato={post.formato} />
        </div>
      )}

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <PilarBadge pilar={post.pilar} />
          <StatusBadge status={post.status} onClick={(e: any) => { e?.stopPropagation(); nextStatus(); }} />
        </div>
        <p className="text-sm font-semibold leading-tight line-clamp-2 mb-1" style={{ color: '#E5E5E5' }}>{post.hook}</p>
        {post.scheduled_date && (
          <p className="text-xs" style={{ color: '#666' }}>
            {new Date(post.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </p>
        )}
      </div>

      {/* Delete on hover */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Excluir post?')) onDelete(post.id); }}
          className="rounded-full w-6 h-6 flex items-center justify-center text-xs shadow"
          style={{ background: 'rgba(10,10,10,0.9)', color: '#EF4444' }}
          title="Excluir">&#10005;</button>
      </div>
    </div>
  );
}
