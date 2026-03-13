import { STATUS_CFG, PILAR_CFG, FORMATO_CFG } from './config';
import type { Status, Pilar, Formato } from '../types';

export function StatusBadge({ status, onClick }: { status: Status; onClick?: (e?: any) => void }) {
  const c = STATUS_CFG[status];
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-75"
      style={{ background: c.bg, color: c.text, border: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.dot }} />
      {c.label}
    </button>
  );
}

export function PilarBadge({ pilar }: { pilar: Pilar }) {
  const c = PILAR_CFG[pilar];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: c.color }}>
      {c.label}
    </span>
  );
}

export function FormatoBadge({ formato }: { formato: Formato }) {
  const c = FORMATO_CFG[formato];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: '#1A1A1A', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span>{c.icon}</span>{c.label}
    </span>
  );
}
