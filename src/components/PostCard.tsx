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
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer group relative"
      onClick={() => onOpen(post)}>

      {/* Image / Video area */}
      <div className="relative bg-gray-100 aspect-[4/5] overflow-hidden">
        {isReel ? (
          /* Reel: video placeholder or link indicator */
          post.video_url ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: '#0A0A0A' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#CCFF00' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A0A0A"><polygon points="6 3 20 12 6 21" /></svg>
              </div>
              <span className="text-xs text-gray-400">Video vinculado</span>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polygon points="10 8 16 12 10 16" fill="currentColor" opacity="0.3" />
              </svg>
              <span className="text-xs">Sem video</span>
            </div>
          )
        ) : (
          /* Carrossel / Single: image */
          imgSrc ? (
            <img src={imgSrc} alt={post.hook} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span className="text-xs">Sem imagem</span>
            </div>
          )
        )}

        {/* Overlay on hover — only for image formats */}
        {!isReel && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onClick={genImage} disabled={loading}
              className="bg-white text-gray-800 text-xs px-3 py-1.5 rounded font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Gerar imagem com IA">
              {loading ? 'Gerando...' : imgSrc ? 'Gerar nova' : 'Gerar imagem'}
            </button>
          </div>
        )}

        {/* Format badge top-right */}
        <div className="absolute top-2 right-2">
          <FormatoBadge formato={post.formato} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <PilarBadge pilar={post.pilar} />
          <StatusBadge status={post.status} onClick={(e: any) => { e?.stopPropagation(); nextStatus(); }} />
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 mb-1">{post.hook}</p>
        {post.scheduled_date && (
          <p className="text-xs text-gray-400">
            {new Date(post.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </p>
        )}
      </div>

      {/* Delete on hover */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Excluir post?')) onDelete(post.id); }}
          className="bg-white/90 text-red-500 hover:text-red-700 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow"
          title="Excluir">&#10005;</button>
      </div>
    </div>
  );
}
