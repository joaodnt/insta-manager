import { useState, useEffect, useCallback } from 'react';
import type { Post, Status, Pilar, Formato } from '../types';
import { api } from '../api';
import { PostCard } from '../components/PostCard';
import { PostModal } from '../components/PostModal';
import { STATUS_CFG, PILAR_CFG, FORMATO_CFG, PILARES, FORMATOS, STATUS_CYCLE } from '../components/config';

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<{ total: number; rascunho: number; pronto: number; agendado: number; postado: number } | null>(null);
  const [selected, setSelected] = useState<Post | null>(null);
  const [view, setView] = useState<'board' | 'grid' | 'calendar'>('board');
  const [filterPilar, setFilterPilar] = useState<Pilar | 'all'>('all');
  const [filterFormato, setFilterFormato] = useState<Formato | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const loadAll = useCallback(async () => {
    const [p, s] = await Promise.all([api.getPosts(), api.getStats()]);
    setPosts(p);
    setStats(s);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = posts.filter(p => {
    if (filterPilar !== 'all' && p.pilar !== filterPilar) return false;
    if (filterFormato !== 'all' && p.formato !== filterFormato) return false;
    if (search && !p.hook.toLowerCase().includes(search.toLowerCase()) && !p.caption.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byStatus = (s: Status) => filtered.filter(p => p.status === s);

  const handleUpdate = (updated: Post) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (selected?.id === updated.id) setSelected(updated);
    api.getStats().then(s => setStats(s));
  };

  const handleDelete = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    api.getStats().then(s => setStats(s));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Top bar */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-40">
        <button onClick={() => setSidebarOpen(v => !v)} className="text-gray-400 hover:text-gray-700 p-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect y="3" width="16" height="1.5" rx=".75" fill="currentColor" />
            <rect y="7.25" width="16" height="1.5" rx=".75" fill="currentColor" />
            <rect y="11.5" width="16" height="1.5" rx=".75" fill="currentColor" />
          </svg>
        </button>
        <span className="font-bold text-gray-900 text-sm">@ojoaonetocp</span>
        <span className="text-gray-300 text-sm">/</span>
        <span className="text-gray-500 text-sm">Instagram Manager</span>
        <div className="flex-1" />

        {/* View toggles */}
        <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['board','grid','calendar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded-md font-medium transition-colors capitalize ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {v === 'board' ? 'Board' : v === 'grid' ? 'Galeria' : 'Calendario'}
            </button>
          ))}
        </div>

        <button onClick={() => setShowNew(true)}
          className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors font-medium">
          + Novo Post
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col overflow-y-auto">
            {/* Stats */}
            {stats && (
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Visao Geral</p>
                <div className="space-y-2">
                  {[
                    { label: 'Total de posts', value: stats.total, color: '#111827' },
                    { label: 'Rascunho', value: stats.rascunho, color: STATUS_CFG.rascunho.dot },
                    { label: 'Pronto', value: stats.pronto, color: STATUS_CFG.pronto.dot },
                    { label: 'Agendado', value: stats.agendado, color: STATUS_CFG.agendado.dot },
                    { label: 'Postado', value: stats.postado, color: STATUS_CFG.postado.dot },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{s.label}</span>
                      <span className="text-xs font-semibold" style={{ color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Postados</span>
                    <span>{stats.total ? Math.round((stats.postado / stats.total) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gray-800 transition-all"
                      style={{ width: `${stats.total ? (stats.postado / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Pilares filter */}
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pilares</p>
              <div className="space-y-0.5">
                <button onClick={() => setFilterPilar('all')}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${filterPilar === 'all' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  Todos os pilares
                </button>
                {PILARES.map(p => (
                  <button key={p} onClick={() => setFilterPilar(p)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${filterPilar === p ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PILAR_CFG[p].color }} />
                    {PILAR_CFG[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Formatos filter */}
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Formatos</p>
              <div className="space-y-0.5">
                <button onClick={() => setFilterFormato('all')}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${filterFormato === 'all' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  Todos
                </button>
                {FORMATOS.map(f => (
                  <button key={f} onClick={() => setFilterFormato(f)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${filterFormato === f ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {FORMATO_CFG[f].icon} {FORMATO_CFG[f].label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Search bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md bg-white outline-none focus:border-gray-400 transition-colors"
                placeholder="Buscar post..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {(search || filterPilar !== 'all' || filterFormato !== 'all') && (
              <button onClick={() => { setSearch(''); setFilterPilar('all'); setFilterFormato('all'); }}
                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-3 py-1.5 bg-white">
                Limpar filtros
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} posts</span>
          </div>

          {/* BOARD VIEW */}
          {view === 'board' && (
            <div className="grid grid-cols-4 gap-4">
              {STATUS_CYCLE.map(s => (
                <div key={s}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_CFG[s].dot }} />
                    <span className="text-xs font-semibold text-gray-700">{STATUS_CFG[s].label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{byStatus(s).length}</span>
                  </div>
                  <div className="space-y-3">
                    {byStatus(s).map(p => (
                      <div key={p.id} className="relative">
                        <PostCard post={p} onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelected} />
                      </div>
                    ))}
                    {byStatus(s).length === 0 && (
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-300">
                        Nenhum post
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GRID VIEW */}
          {view === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map(p => (
                <div key={p.id} className="relative">
                  <PostCard post={p} onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelected} />
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-gray-400 text-sm py-16">Nenhum post encontrado.</div>
              )}
            </div>
          )}

          {/* CALENDAR VIEW */}
          {view === 'calendar' && <CalendarView posts={filtered} onOpen={setSelected} />}
        </main>
      </div>

      {/* Post modal */}
      <PostModal post={selected} onClose={() => setSelected(null)} onSave={handleUpdate} onDelete={(id) => { handleDelete(id); api.deletePost(id); }} />

      {/* New post modal */}
      {showNew && <NewPostModal onClose={() => setShowNew(false)} onCreate={(p) => { setPosts(prev => [p, ...prev]); setShowNew(false); setSelected(p); }} />}
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────
function CalendarView({ posts, onOpen }: { posts: Post[]; onOpen: (p: Post) => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const MONTHS = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const postsByDate: Record<string, Post[]> = {};
  for (const p of posts) {
    if (p.scheduled_date) {
      const [y, m, d] = p.scheduled_date.split('-').map(Number);
      if (y === year && m === month + 1) {
        const key = String(d);
        if (!postsByDate[key]) postsByDate[key] = [];
        postsByDate[key].push(p);
      }
    }
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <button onClick={prev} className="text-gray-400 hover:text-gray-700 transition-colors text-lg">‹</button>
        <span className="font-semibold text-gray-800">{MONTHS[month]} {year}</span>
        <button onClick={next} className="text-gray-400 hover:text-gray-700 transition-colors text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => (
          <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dayPosts = day ? (postsByDate[String(day)] || []) : [];
          return (
            <div key={i} className={`bg-white min-h-[80px] p-1.5 ${!day ? 'bg-gray-50' : ''}`}>
              {day && (
                <>
                  <span className={`text-xs font-medium inline-flex items-center justify-center w-5 h-5 rounded-full mb-1 ${isToday ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>{day}</span>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map(p => (
                      <button key={p.id} onClick={() => onOpen(p)}
                        className="w-full text-left text-xs px-1 py-0.5 rounded truncate hover:opacity-75 transition-opacity text-white"
                        style={{ background: PILAR_CFG[p.pilar].color }}>
                        {p.hook.slice(0, 25)}...
                      </button>
                    ))}
                    {dayPosts.length > 3 && <span className="text-xs text-gray-400">+{dayPosts.length - 3}</span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── New post modal ────────────────────────────────────────
function NewPostModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Post) => void }) {
  const [form, setForm] = useState({ hook: '', caption: '', pilar: 'bastidores' as Pilar, formato: 'reel' as Formato, scheduled_date: '', image_prompt: '', hashtags: '#infoproduto #automatizacao #IA #infomestre' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.hook) return alert('Preencha o hook');
    setLoading(true);
    try {
      const p = await api.createPost(form);
      onCreate(p);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Novo Post</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Pilar</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
              value={form.pilar} onChange={e => set('pilar', e.target.value)}>
              {PILARES.map(p => <option key={p} value={p}>{PILAR_CFG[p].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Formato</label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
              value={form.formato} onChange={e => set('formato', e.target.value)}>
              {FORMATOS.map(f => <option key={f} value={f}>{FORMATO_CFG[f].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
            <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
              value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hook</label>
          <input type="text" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
            placeholder="A frase que para o scroll..." value={form.hook} onChange={e => set('hook', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Caption</label>
          <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 resize-none"
            rows={4} value={form.caption} onChange={e => set('caption', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Prompt da imagem</label>
          <input type="text" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
            placeholder="Descreva a imagem para gerar com IA..." value={form.image_prompt} onChange={e => set('image_prompt', e.target.value)} />
        </div>
        <button onClick={submit} disabled={loading}
          className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {loading ? 'Criando...' : 'Criar Post'}
        </button>
      </div>
    </div>
  );
}
