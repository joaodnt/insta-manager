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
  'noticias':    { label: 'Noticias',     color: '#F97316' },
};

export const FORMATO_CFG: Record<Formato, { label: string; icon: string }> = {
  reel:      { label: 'Reel',      icon: '▶' },
  carrossel: { label: 'Carrossel', icon: '⊞' },
  single:    { label: 'Single',    icon: '□' },
};

export const STATUS_CYCLE: Status[] = ['rascunho', 'em-producao', 'pronto', 'agendado', 'postado'];
export const PILARES: Pilar[] = ['bastidores', 'sistemas', 'ia-aplicada', 'provocacao', 'resultado', 'noticias'];

// ── Pilar-specific default slide presets for carousels ──────
export const PILAR_SLIDE_PRESETS: Record<Pilar, { label: string; hint: string }[]> = {
  bastidores: [
    { label: 'Hook — capa que para o scroll', hint: 'Frase impactante mostrando o bastidor real' },
    { label: 'Contexto — o cenario real', hint: 'Situacao, momento, o que estava acontecendo' },
    { label: 'Processo — como foi feito', hint: 'Etapas, ferramentas, decisoes tomadas' },
    { label: 'Dificuldade — o que deu errado', hint: 'Obstaculos, erros, aprendizados no caminho' },
    { label: 'Resultado — o que saiu disso', hint: 'O que foi conquistado, numero, prova real' },
    { label: 'Licao — aprendizado chave', hint: 'O que voce aprendeu e quer compartilhar' },
    { label: 'CTA — chamada para acao', hint: 'Convite para seguir, salvar, comentar' },
  ],
  sistemas: [
    { label: 'Hook — capa que para o scroll', hint: 'Promessa do sistema ou automacao' },
    { label: 'Problema — sem o sistema', hint: 'A dor de fazer tudo manual, sem estrutura' },
    { label: 'Sistema — a solucao', hint: 'O que e o sistema, visao geral da estrutura' },
    { label: 'Passo 1 — configuracao', hint: 'Primeira etapa do setup do sistema' },
    { label: 'Passo 2 — automacao', hint: 'Segunda etapa, integracao ou automacao' },
    { label: 'Passo 3 — escala', hint: 'Como o sistema escala sozinho' },
    { label: 'Resultado — prova que funciona', hint: 'Numeros, prints, provas do sistema rodando' },
    { label: 'CTA — chamada para acao', hint: 'Link, bio, proximo passo' },
  ],
  'ia-aplicada': [
    { label: 'Hook — capa que para o scroll', hint: 'Ferramenta ou tecnica de IA impressionante' },
    { label: 'Ferramenta — qual IA usar', hint: 'Nome da ferramenta, o que ela faz' },
    { label: 'Como funciona — passo a passo', hint: 'Tutorial rapido, prompt ou configuracao' },
    { label: 'Demonstracao — antes vs depois', hint: 'Resultado pratico, print, comparacao' },
    { label: 'Dica extra — hack ou truque', hint: 'Algo que potencializa o resultado' },
    { label: 'Resultado — economia real', hint: 'Tempo economizado, dinheiro, produtividade' },
    { label: 'CTA — chamada para acao', hint: 'Salve, teste, comente qual vai usar' },
  ],
  provocacao: [
    { label: 'Hook — capa provocadora', hint: 'Afirmacao controversa ou dado chocante' },
    { label: 'Provocacao — a verdade incomoda', hint: 'Expanda a provocacao, questione o status quo' },
    { label: 'Dados — prova do argumento', hint: 'Estatisticas, numeros, fatos que sustentam' },
    { label: 'Comparacao — quem faz certo vs errado', hint: 'Contraste entre os dois lados' },
    { label: 'Verdade — o que ninguem fala', hint: 'O insight que diferencia quem sabe' },
    { label: 'Solucao — o caminho certo', hint: 'O que fazer diferente, a mudanca' },
    { label: 'CTA — chamada para acao', hint: 'Comente, compartilhe, marque alguem' },
  ],
  resultado: [
    { label: 'Hook — capa com numero/resultado', hint: 'Numero impactante, resultado real' },
    { label: 'Contexto — o ponto de partida', hint: 'De onde partiu, situacao inicial' },
    { label: 'Estrategia — o que foi feito', hint: 'Acoes tomadas, decisoes chave' },
    { label: 'Numeros — dados concretos', hint: 'Faturamento, conversao, metricas reais' },
    { label: 'Antes vs Depois — transformacao', hint: 'Comparacao visual ou textual clara' },
    { label: 'Aprendizado — o que funcionou', hint: 'Insights, o que repetir ou evitar' },
    { label: 'Prova — print ou screenshot', hint: 'Dashboard, extrato, depoimento' },
    { label: 'CTA — proximo passo', hint: 'Link, bio, convite para saber mais' },
  ],
  noticias: [
    { label: 'Hook — manchete que para o scroll', hint: 'Noticia impactante do mercado digital' },
    { label: 'Noticia — o que aconteceu', hint: 'Fatos, contexto da noticia, fonte' },
    { label: 'O que mudou — impacto direto', hint: 'Como isso afeta o mercado, ferramentas, estrategias' },
    { label: 'Para quem importa — publico afetado', hint: 'Quem precisa prestar atencao nisso' },
    { label: 'Oportunidade — como aproveitar', hint: 'O que fazer agora, como se posicionar' },
    { label: 'Opiniao — analise Infomestre', hint: 'Sua visao, previsao, posicionamento' },
    { label: 'CTA — chamada para acao', hint: 'Siga para mais noticias, comente sua opiniao' },
  ],
};
export const FORMATOS: Formato[] = ['reel', 'carrossel', 'single'];
