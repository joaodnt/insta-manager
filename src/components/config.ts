import type { Status, Pilar, Formato } from '../types';

export const STATUS_CFG: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  rascunho: { label: 'Rascunho',    dot: '#9CA3AF', bg: '#F9FAFB', text: '#6B7280' },
  pronto:   { label: 'Pronto',      dot: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8' },
  agendado: { label: 'Agendado',    dot: '#D97706', bg: '#FFFBEB', text: '#B45309' },
  postado:  { label: 'Postado',     dot: '#16A34A', bg: '#F0FDF4', text: '#15803D' },
};

export const PILAR_CFG: Record<Pilar, { label: string; color: string }> = {
  'bastidores':  { label: 'Bastidores',   color: '#7C3AED' },
  'sistemas':    { label: 'Sistemas',     color: '#0369A1' },
  'ia-aplicada': { label: 'IA Aplicada',  color: '#0891B2' },
  'provocacao':  { label: 'Provocacao',   color: '#DC2626' },
  'resultado':   { label: 'Resultado',    color: '#16A34A' },
};

export const FORMATO_CFG: Record<Formato, { label: string; icon: string }> = {
  reel:      { label: 'Reel',      icon: '▶' },
  carrossel: { label: 'Carrossel', icon: '⊞' },
  single:    { label: 'Single',    icon: '□' },
};

export const STATUS_CYCLE: Status[] = ['rascunho', 'pronto', 'agendado', 'postado'];
export const PILARES: Pilar[] = ['bastidores', 'sistemas', 'ia-aplicada', 'provocacao', 'resultado'];
export const FORMATOS: Formato[] = ['reel', 'carrossel', 'single'];
