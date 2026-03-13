export type Status = 'rascunho' | 'em-producao' | 'pronto' | 'agendado' | 'postado';
export type Pilar = 'bastidores' | 'sistemas' | 'ia-aplicada' | 'provocacao' | 'resultado';
export type Formato = 'reel' | 'carrossel' | 'single';

export interface Post {
  id: string;
  hook: string;
  caption: string;
  corpo: string;
  cta: string;
  pilar: Pilar;
  formato: Formato;
  status: Status;
  scheduled_date: string | null;
  image_url: string | null;
  image_prompt: string;
  video_url: string | null;
  hashtags: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  total: number;
  rascunho: number;
  'em-producao': number;
  pronto: number;
  agendado: number;
  postado: number;
  byPilar: { pilar: string; c: number }[];
  byFormato: { formato: string; c: number }[];
}
