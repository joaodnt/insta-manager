import type { Post, Stats, Slide } from './types';

const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(BASE + url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error((await r.json()).error || r.statusText);
  return r.json();
}

export const api = {
  getPosts:    (params?: Record<string, string>) => req<Post[]>('/api/posts?' + new URLSearchParams(params || {}).toString()),
  getPost:     (id: string) => req<Post>(`/api/posts/${id}`),
  createPost:  (data: Partial<Post>) => req<Post>('/api/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost:  (id: string, data: Partial<Post>) => req<Post>(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost:  (id: string) => req<{ ok: boolean }>(`/api/posts/${id}`, { method: 'DELETE' }),
  bulkDelete:  (ids: string[]) => req<{ ok: boolean; deleted: number }>('/api/posts/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  getStats:    () => req<Stats>('/api/stats'),
  generateImage: (prompt: string, postId?: string) =>
    req<{ url: string; filename: string }>('/api/generate-image', { method: 'POST', body: JSON.stringify({ prompt, postId }) }),
  rewriteCopy: (data: { caption: string; hook: string; references: string; formato: string }) =>
    req<{ hook: string; caption: string }>('/api/rewrite-copy', { method: 'POST', body: JSON.stringify(data) }),
  rewriteSection: (data: { section: string; content: string; context?: string; references?: string; formato: string }) =>
    req<{ rewritten: string }>('/api/rewrite-section', { method: 'POST', body: JSON.stringify(data) }),
  generatePrompt: (data: { slideLabel: string; slideContent: string; context?: string; formato: string }) =>
    req<{ prompt: string }>('/api/generate-prompt', { method: 'POST', body: JSON.stringify(data) }),
  generateSlidesContent: (data: { pilar: string; hook?: string; topic?: string; slides: { label: string }[]; formato: string }) =>
    req<{ hook: string; caption: string; slides: { label: string; content: string }[] }>('/api/generate-slides-content', { method: 'POST', body: JSON.stringify(data) }),
  fetchNews: () =>
    req<{ news: { title: string; summary: string; source: string; url: string }[] }>('/api/fetch-news', { method: 'POST', body: JSON.stringify({}) }),
  generateSlidesImages: (data: { postId: string; slides: Slide[]; aspectRatio: string }) =>
    req<{ results: { index: number; url: string | null; error?: string }[] }>('/api/generate-slides-images', { method: 'POST', body: JSON.stringify(data) }),
  getSettings:   () => req<Record<string, string>>('/api/settings'),
  saveSettings:  (data: Record<string, string>) => req<{ ok: boolean }>('/api/settings', { method: 'POST', body: JSON.stringify(data) }),
};
