import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post, Status, Pilar, Formato } from '../types';
import { api } from '../api';
import { PostCard } from '../components/PostCard';
import { PostModal } from '../components/PostModal';
import { STATUS_CFG, PILAR_CFG, FORMATO_CFG, PILARES, FORMATOS, STATUS_CYCLE } from '../components/config';

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<{ total: number; rascunho: number; 'em-producao': number; pronto: number; agendado: number; postado: number } | null>(null);
  const [selected, setSelected] = useState<Post | null>(null);
  const [view, setView] = useState<'board' | 'grid' | 'calendar'>('board');
  const [filterPilar, setFilterPilar] = useState<Pilar | 'all'>('all');
  const [filterFormato, setFilterFormato] = useState<Formato | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNew, setShowNew] = useState(false);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} post${selectedIds.size > 1 ? 's' : ''}? Esta acao nao pode ser desfeita.`)) return;
    setBulkDeleting(true);
    try {
      await api.bulkDelete(Array.from(selectedIds));
      setPosts(prev => prev.filter(p => !selectedIds.has(p.id)));
      api.getStats().then(s => setStats(s as any));
      exitSelectMode();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // drag-and-drop state
  const dragPostId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  const loadAll = useCallback(async () => {
    const [p, s] = await Promise.all([api.getPosts(), api.getStats()]);
    setPosts(p);
    setStats(s as any);
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
    api.getStats().then(s => setStats(s as any));
  };

  const handleDelete = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    api.getStats().then(s => setStats(s as any));
  };

  const handleDrop = async (targetStatus: Status) => {
    if (!dragPostId.current) return;
    setDragOver(null);
    const id = dragPostId.current;
    dragPostId.current = null;
    const current = posts.find(p => p.id === id);
    if (!current || current.status === targetStatus) return;
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: targetStatus } : p));
    try {
      const updated = await api.updatePost(id, { status: targetStatus });
      handleUpdate(updated);
    } catch {
      loadAll();
    }
  };

  const sidebarStats = stats ? [
    { label: 'Total de posts',  value: stats.total,             color: '#CCFF00' },
    { label: 'Rascunho',        value: stats.rascunho,          color: STATUS_CFG.rascunho.dot },
    { label: 'Em Producao',     value: stats['em-producao'],    color: STATUS_CFG['em-producao'].dot },
    { label: 'Pronto',          value: stats.pronto,            color: STATUS_CFG.pronto.dot },
    { label: 'Agendado',        value: stats.agendado,          color: STATUS_CFG.agendado.dot },
    { label: 'Postado',         value: stats.postado,           color: STATUS_CFG.postado.dot },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0A0A', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>

      {/* Top bar */}
      <header className="h-12 flex items-center px-4 gap-4 sticky top-0 z-40"
        style={{ background: '#0F0F0F', borderBottom: '1px solid #1A1A1A' }}>
        <button onClick={() => setSidebarOpen(v => !v)} className="p-1 transition-colors" style={{ color: '#666' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect y="3" width="16" height="1.5" rx=".75" fill="currentColor" />
            <rect y="7.25" width="16" height="1.5" rx=".75" fill="currentColor" />
            <rect y="11.5" width="16" height="1.5" rx=".75" fill="currentColor" />
          </svg>
        </button>
        <span className="font-bold text-sm" style={{ color: '#CCFF00' }}>@ojoaonetocp</span>
        <span className="text-sm" style={{ color: '#333' }}>/</span>
        <span className="text-sm" style={{ color: '#666' }}>Instagram Manager</span>
        <div className="flex-1" />

        {/* View toggles */}
        <div className="hidden sm:flex items-center gap-1 rounded-lg p-1" style={{ background: '#111' }}>
          {(['board','grid','calendar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="text-xs px-3 py-1 rounded-md font-medium transition-colors capitalize"
              style={view === v
                ? { background: '#1A1A1A', color: '#CCFF00' }
                : { color: '#666' }}>
              {v === 'board' ? 'Board' : v === 'grid' ? 'Galeria' : 'Calendario'}
            </button>
          ))}
        </div>

        <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={selectMode
            ? { background: '#CCFF00', color: '#0A0A0A' }
            : { color: '#888', border: '1px solid #333' }}>
          {selectMode ? 'Cancelar' : 'Selecionar'}
        </button>

        <button onClick={() => setShowNew(true)}
          className="text-xs px-4 py-1.5 rounded-lg font-semibold transition-colors"
          style={{ background: '#CCFF00', color: '#0A0A0A' }}>
          + Novo Post
        </button>
      </header>

      {/* Bulk actions bar */}
      {selectMode && (
        <div className="sticky top-12 z-30 flex items-center justify-between px-4 py-2"
          style={{ background: '#111', borderBottom: '1px solid #1A1A1A' }}>
          <div className="flex items-center gap-3">
            <button onClick={selectAll}
              className="text-xs px-3 py-1 rounded-md font-medium transition-colors"
              style={{ color: '#CCFF00', border: '1px solid #333' }}>
              {selectedIds.size === filtered.length && filtered.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span className="text-xs" style={{ color: '#888' }}>
              {selectedIds.size} {selectedIds.size === 1 ? 'post selecionado' : 'posts selecionados'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={bulkDelete} disabled={selectedIds.size === 0 || bulkDeleting}
              className="text-xs px-4 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-30 flex items-center gap-1.5"
              style={{ background: '#EF4444', color: '#FFF' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
              {bulkDeleting ? 'Excluindo...' : `Excluir${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-56 flex-shrink-0 flex flex-col overflow-y-auto"
            style={{ background: '#0F0F0F', borderRight: '1px solid #1A1A1A' }}>
            {/* Stats */}
            {stats && (
              <div className="p-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#555' }}>Visao Geral</p>
                <div className="space-y-2">
                  {sidebarStats.map(s => (
                    <div key={s.label} className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: '#888' }}>{s.label}</span>
                      <span className="text-xs font-semibold" style={{ color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: '#555' }}>
                    <span>Postados</span>
                    <span>{stats.total ? Math.round((stats.postado / stats.total) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: '#1A1A1A' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${stats.total ? (stats.postado / stats.total) * 100 : 0}%`, background: '#CCFF00' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Pilares filter */}
            <div className="p-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#555' }}>Pilares</p>
              <div className="space-y-0.5">
                <button onClick={() => setFilterPilar('all')}
                  className="w-full text-left text-xs px-2 py-1.5 rounded transition-colors"
                  style={filterPilar === 'all' ? { background: '#1A1A1A', color: '#CCFF00', fontWeight: 500 } : { color: '#888' }}>
                  Todos os pilares
                </button>
                {PILARES.map(p => (
                  <button key={p} onClick={() => setFilterPilar(p)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-2"
                    style={filterPilar === p ? { background: '#1A1A1A', color: '#E5E5E5', fontWeight: 500 } : { color: '#888' }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PILAR_CFG[p].color }} />
                    {PILAR_CFG[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Formatos filter */}
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#555' }}>Formatos</p>
              <div className="space-y-0.5">
                <button onClick={() => setFilterFormato('all')}
                  className="w-full text-left text-xs px-2 py-1.5 rounded transition-colors"
                  style={filterFormato === 'all' ? { background: '#1A1A1A', color: '#CCFF00', fontWeight: 500 } : { color: '#888' }}>
                  Todos
                </button>
                {FORMATOS.map(f => (
                  <button key={f} onClick={() => setFilterFormato(f)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded transition-colors"
                    style={filterFormato === f ? { background: '#1A1A1A', color: '#E5E5E5', fontWeight: 500 } : { color: '#888' }}>
                    {FORMATO_CFG[f].icon} {FORMATO_CFG[f].label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Main */}
        <main className="flex-1 overflow-auto p-6">
          {/* Search bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#555' }}>
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input className="w-full pl-9 pr-4 py-1.5 text-sm rounded-md outline-none transition-colors"
                style={{ background: '#111', border: '1px solid #222', color: '#E5E5E5' }}
                placeholder="Buscar post..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {(search || filterPilar !== 'all' || filterFormato !== 'all') && (
              <button onClick={() => { setSearch(''); setFilterPilar('all'); setFilterFormato('all'); }}
                className="text-xs px-3 py-1.5 rounded"
                style={{ color: '#888', border: '1px solid #222' }}>
                Limpar filtros
              </button>
            )}
            <span className="text-xs ml-auto" style={{ color: '#555' }}>{filtered.length} posts</span>
          </div>

          {/* BOARD VIEW — drag-and-drop */}
          {view === 'board' && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STATUS_CYCLE.map(s => (
                <div key={s}
                  onDragOver={e => { e.preventDefault(); setDragOver(s); }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                  }}
                  onDrop={() => handleDrop(s)}
                  className="flex-shrink-0 w-[220px] rounded-xl p-2 transition-all"
                  style={{
                    background: dragOver === s ? '#111' : 'transparent',
                    outline: dragOver === s ? `2px solid ${STATUS_CFG[s].dot}` : '2px solid transparent',
                  }}>
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_CFG[s].dot }} />
                    <span className="text-xs font-semibold" style={{ color: '#CCC' }}>{STATUS_CFG[s].label}</span>
                    <span className="text-xs ml-auto" style={{ color: '#555' }}>{byStatus(s).length}</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 min-h-[60px]">
                    {byStatus(s).map(p => (
                      <div key={p.id}
                        draggable={!selectMode}
                        onDragStart={() => { if (!selectMode) dragPostId.current = p.id; }}
                        onDragEnd={() => { dragPostId.current = null; setDragOver(null); }}
                        className={`relative ${selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing active:opacity-60'} transition-opacity`}>
                        <PostCard post={p} onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelected}
                          selectMode={selectMode} isSelected={selectedIds.has(p.id)} onToggleSelect={toggleSelect} />
                      </div>
                    ))}
                    {byStatus(s).length === 0 && (
                      <div className="rounded-lg p-4 text-center text-xs select-none"
                        style={{ border: '2px dashed #222', color: '#333' }}>
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
                  <PostCard post={p} onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelected}
                    selectMode={selectMode} isSelected={selectedIds.has(p.id)} onToggleSelect={toggleSelect} />
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-sm py-16" style={{ color: '#555' }}>Nenhum post encontrado.</div>
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
        <button onClick={prev} className="transition-colors text-lg" style={{ color: '#666' }}>‹</button>
        <span className="font-semibold" style={{ color: '#E5E5E5' }}>{MONTHS[month]} {year}</span>
        <button onClick={next} className="transition-colors text-lg" style={{ color: '#666' }}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden" style={{ background: '#1A1A1A' }}>
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => (
          <div key={d} className="text-center text-xs font-medium py-2" style={{ background: '#111', color: '#666' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dayPosts = day ? (postsByDate[String(day)] || []) : [];
          return (
            <div key={i} className="min-h-[80px] p-1.5"
              style={{ background: day ? '#0F0F0F' : '#0A0A0A' }}>
              {day && (
                <>
                  <span className="text-xs font-medium inline-flex items-center justify-center w-5 h-5 rounded-full mb-1"
                    style={isToday ? { background: '#CCFF00', color: '#0A0A0A' } : { color: '#888' }}>
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map(p => (
                      <button key={p.id} onClick={() => onOpen(p)}
                        className="w-full text-left text-xs px-1 py-0.5 rounded truncate hover:opacity-75 transition-opacity text-white"
                        style={{ background: PILAR_CFG[p.pilar].color }}>
                        {p.hook.slice(0, 25)}...
                      </button>
                    ))}
                    {dayPosts.length > 3 && <span className="text-xs" style={{ color: '#555' }}>+{dayPosts.length - 3}</span>}
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

// ── New post modal (simplified — opens full editor after creation) ──
const TEMA_PLACEHOLDERS: Record<Pilar, string> = {
  'bastidores': 'Ex: mostrar como criei meu ultimo infoproduto em 3 dias usando IA',
  'sistemas': 'Ex: como automatizar o atendimento de clientes com n8n e ChatGPT',
  'ia-aplicada': 'Ex: tutorial de como usar o ChatGPT para criar scripts de Reels',
  'provocacao': 'Ex: por que 90% dos infoprodutores vao falir em 2025',
  'resultado': 'Ex: como saimos de 0 a 50k de faturamento em 60 dias com automacao',
  'noticias': 'Ex: noticias de IA e automacao desta semana e como impactam infoprodutores',
};

function NewPostModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Post) => void }) {
  const [form, setForm] = useState({ tema: '', pilar: 'bastidores' as Pilar, formato: 'reel' as Formato, scheduled_date: '', hashtags: '#infoproduto #automatizacao #IA #infomestre' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.tema) return alert('Descreva o tema do post');
    setLoading(true);
    try {
      // Store tema in hook temporarily — PostModal auto-gen will use it as topic
      const p = await api.createPost({ ...form, hook: form.tema });
      onCreate(p);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: '#111', border: '1px solid #222', color: '#E5E5E5' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4"
        style={{ background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: '#E5E5E5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Novo Post</h2>
          <button onClick={onClose} style={{ color: '#666' }}>&#10005;</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>Pilar</label>
            <select className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
              value={form.pilar} onChange={e => set('pilar', e.target.value)}>
              {PILARES.map(p => <option key={p} value={p}>{PILAR_CFG[p].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>Formato</label>
            <select className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
              value={form.formato} onChange={e => set('formato', e.target.value)}>
              {FORMATOS.map(f => <option key={f} value={f}>{FORMATO_CFG[f].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>Data</label>
            <input type="date" className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
              value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>Tema / Sobre o que e o post?</label>
          <textarea className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle}
            rows={3}
            placeholder={TEMA_PLACEHOLDERS[form.pilar] || 'Descreva o tema do post...'}
            value={form.tema} onChange={e => set('tema', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          <p className="text-xs mt-1" style={{ color: '#444' }}>
            A IA vai gerar o hook, textos e conteudo automaticamente com base no tema.
          </p>
        </div>
        <button onClick={submit} disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: '#CCFF00', color: '#0A0A0A' }}>
          {loading ? 'Criando...' : 'Criar e Editar'}
        </button>
      </div>
    </div>
  );
}
