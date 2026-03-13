import type { Status, Pilar, Formato } from '../types';

export const STATUS_CFG: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  rascunho:      { label: 'Rascunho',     dot: '#6B7280', bg: '#1A1A1A', text: '#9CA3AF' },
  'em-producao': { label: 'Em Produção',  dot: '#CCFF00', bg: '#1A2600', text: '#CCFF00' },
  pronto:        { label: 'Pronto',       dot: '#3B82F6', bg: '#0A1628', text: '#60A5FA' },
  agendado:      { label: 'Agendado',     dot: '#F59E0B', bg: '#1A1400', text: '#FBBF24' },
  postado:       { label: 'Postado',      dot: '#22C55E', bg: '#0A1A0F', text: '#4ADE80' },
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

export const STATUS_CYCLE: Status[] = ['rascunho', 'em-producao', 'pronto', 'agendado', 'postado'];
export const PILARES: Pilar[] = ['bastidores', 'sistemas', 'ia-aplicada', 'provocacao', 'resultado'];
export const FORMATOS: Formato[] = ['reel', 'carrossel', 'single'];
