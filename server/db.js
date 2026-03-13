const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE  = path.join(DATA_DIR, 'posts.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── In-memory store ────────────────────────────────────────
let store = { posts: [], settings: {} };

function load() {
  try {
    if (fs.existsSync(DB_FILE)) store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { store = { posts: [], settings: {} }; }
  if (!store.settings) store.settings = {};
  if (!store.posts) store.posts = [];
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2));
}

load();

// ── Seed 30 posts if empty ────────────────────────────────
if (store.posts.length === 0) {
  const now = new Date().toISOString();
  const startDate = new Date();

  const POSTS = [
    { day: 1,  pilar: 'bastidores',   formato: 'reel',      hook: 'Minha esposa entrou em trabalho de parto e eu ainda estava respondendo DM de aluno.', caption: 'Foi aí que decidi automatizar tudo. Hoje meu infoproduto roda enquanto estou com minha família.\n\nEu me chamo João Neto e aqui eu mostro como fazer isso.\n\nSegue pra ver os bastidores de como eu construí isso.\n\n.\n.\n#infoproduto #automatizacao #IA #infomestre #inteligenciaartificial #marketingdigital #infoprodutor #rendaonline #empreendedorismo', image_prompt: 'Brazilian man working on laptop at home desk at night, warm light, cinematic, vertical 9:16, professional Instagram Reel thumbnail' },
    { day: 2,  pilar: 'provocacao',   formato: 'carrossel', hook: 'Você está pagando R$ 3.000/mês por um sistema que a IA faz de graça.', caption: 'Infoprodutores pagam caro por sistemas que a IA já faz em minutos.\n\nNo próximo post eu mostro como substituir cada um deles.\n\nSalva esse carrossel.\n\n#infoproduto #IA #automatizacao #infomestre', image_prompt: 'Split screen showing expensive software vs free AI tools, dark background, red and green contrast, professional marketing design 1:1' },
    { day: 3,  pilar: 'ia-aplicada',  formato: 'reel',      hook: 'Essa ferramenta de IA escreve toda a sua página de vendas em 8 minutos.', caption: 'Prompt completo nos comentários.\n\nSalva esse post e testa hoje mesmo.\n\n#infoproduto #IA #automatizacao #paginadevendas', image_prompt: 'Computer screen showing AI writing sales page copy, glowing interface, dark tech aesthetic, cinematic 9:16' },
    { day: 4,  pilar: 'provocacao',   formato: 'single',    hook: 'Infoprodutor que faz tudo na mão em 2025 não é dedicado. É lento.', caption: 'Automatizar não é preguiça. É estratégia.\n\nO que você ainda está fazendo na mão que poderia automatizar hoje?\n\n#infoproduto #IA #produtividade', image_prompt: 'Bold text quote on dark background, white minimalist typography, modern design, Instagram post 1:1' },
    { day: 5,  pilar: 'sistemas',     formato: 'reel',      hook: 'Esse funil perpétuo vende todo dia sem eu abrir o computador.', caption: 'Anúncio → VSL → Checkout → Área de membros.\n\nTudo automático. Tudo 24/7.\n\nLink na bio pra ver a estrutura completa.\n\n#funilperpertuo #infoproduto #automatizacao', image_prompt: 'Funnel diagram with arrows, modern flat design, blue and white gradient, professional infographic 9:16' },
    { day: 6,  pilar: 'bastidores',   formato: 'reel',      hook: 'Construí meu primeiro infoproduto enquanto meu filho dormia.', caption: 'Mesa, notebook, madrugada e muita determinação.\n\nEsse é o processo real. Sem glamour.\n\nMas hoje o sistema trabalha por mim.\n\n#infoprodutor #bastidores #empreendedorismo', image_prompt: 'Father working on laptop late at night while baby sleeps in background, warm cozy light, emotional cinematic 9:16' },
    { day: 7,  pilar: 'ia-aplicada',  formato: 'carrossel', hook: '5 prompts de IA que eu uso todo dia no meu infoproduto.', caption: 'Salva esse carrossel.\n\nCada prompt te economiza pelo menos 2 horas de trabalho por semana.\n\nQual você vai testar primeiro?\n\n#IA #prompts #ChatGPT #infoproduto', image_prompt: 'Five prompt cards on dark background, numbered list design, glowing AI aesthetic, professional content 1:1' },
    { day: 8,  pilar: 'sistemas',     formato: 'reel',      hook: 'Como eu configurei meu suporte com IA e nunca mais precisei responder a mesma pergunta duas vezes.', caption: 'FAQ automatizado + bot com IA = suporte 24/7.\n\nSetup: 2 horas.\n\nResultado: nunca mais ficar preso respondendo DM.\n\n#automatizacao #suporte #IA #infoproduto', image_prompt: 'AI chatbot interface on phone screen, modern flat design, customer support automation, dark tech 9:16' },
    { day: 9,  pilar: 'provocacao',   formato: 'carrossel', hook: 'Por que 90% dos infoprodutores não escalam? (não é o que você pensa)', caption: 'Não é falta de produto.\nNão é falta de tráfego.\nÉ falta de sistema.\n\nCada slide destrói um mito.\n\n#infoprodutor #escala #sistema #marketingdigital', image_prompt: '90% vs 10% infographic, bold typography, dark background, statistics visualization, professional 1:1' },
    { day: 10, pilar: 'ia-aplicada',  formato: 'reel',      hook: 'Eu gerei 30 ideias de Reels em 3 minutos com IA. Aqui está como.', caption: 'Demonstração ao vivo.\n\nPrompt nos comentários.\n\nGrava e me conta quantas ideias você gerou.\n\n#IA #contentcreator #reels #infoproduto', image_prompt: 'Screen recording of AI generating content ideas, colorful brainstorm visualization, creative 9:16' },
    { day: 11, pilar: 'ia-aplicada',  formato: 'single',    hook: 'Seu concorrente já automatizou. Você ainda está digitando e-mail na mão?', caption: 'E-mail marketing automatizado com IA:\n→ Boas-vindas\n→ Sequência de engajamento\n→ Reativação\n\nTudo sem você tocar.\n\n#emailmarketing #IA #automatizacao', image_prompt: 'Competitor vs you race concept, bold split design, competitive energy, minimalist 1:1' },
    { day: 12, pilar: 'bastidores',   formato: 'reel',      hook: 'Mostrando a estrutura completa do Infomestre — 79 tarefas para lançar um infoproduto com IA.', caption: 'Produto → Plataforma → Vendas → Checkout → Tráfego → Funil → E-mail → Orgânico → Escala → Pós-venda.\n\n79 tarefas. Tudo mapeado.\n\n#infomestre #infoproduto #sistemadevendas', image_prompt: 'Project management dashboard on screen, organized task board, professional workspace 9:16' },
    { day: 13, pilar: 'sistemas',     formato: 'carrossel', hook: 'O funil perpétuo que roda sem lançamento, sem captura e sem você.', caption: 'Direct Response puro:\nAnúncio → VSL → Checkout.\n\nSem evento. Sem captura. Sem abrir carrinho.\n\nSempre vendendo.\n\n#funilperpertuo #directresponse #infoproduto', image_prompt: 'Perpetual sales funnel diagram, evergreen concept, continuous flow arrows, marketing infographic 1:1' },
    { day: 14, pilar: 'resultado',    formato: 'reel',      hook: 'Primeira semana com o funil no ar. Aqui está o que aconteceu.', caption: 'Números reais. Nada embelezado.\n\nO que funcionou, o que não funcionou e o que mudei.\n\nTransparência gera confiança.\n\n#resultados #infoproduto #funildevendas', image_prompt: 'Dashboard showing sales analytics, real numbers, week 1 results, data visualization, dark theme 9:16' },
    { day: 15, pilar: 'ia-aplicada',  formato: 'reel',      hook: 'Essa IA criou meu anúncio inteiro. Criativo + copy + segmentação.', caption: 'AdCreative + ChatGPT = anúncio completo em 15 minutos.\n\nMostrando o resultado final ao vivo.\n\n#IA #trafegopago #anuncio #infoproduto', image_prompt: 'AI-generated advertisement on screen, Facebook Ads interface, creative design process 9:16' },
    { day: 16, pilar: 'provocacao',   formato: 'carrossel', hook: 'O que um infoprodutor que fatura R$ 50k/mês faz diferente de quem fatura R$ 1k.', caption: 'A diferença não está no produto.\nEstá no sistema.\n\nCada slide compara o comportamento dos dois.\n\n#infoprodutor #escalabilidade #sistema #marketingdigital', image_prompt: 'Before and after comparison, R$1k vs R$50k mindset, bold split design, business infographic 1:1' },
    { day: 17, pilar: 'sistemas',     formato: 'reel',      hook: 'Como eu uso IA para criar aulas sem aparecer na câmera.', caption: 'Avatar de IA + roteiro gerado por IA = aula profissional sem gravar.\n\nHeyGen, Synthesia e mais.\n\nFunciona de verdade.\n\n#IA #avatar #infoproduto #cursoonline', image_prompt: 'AI avatar presenting online course, futuristic digital classroom, virtual instructor 9:16' },
    { day: 18, pilar: 'ia-aplicada',  formato: 'single',    hook: 'A IA não vai substituir infoprodutores. Vai substituir infoprodutores que não usam IA.', caption: 'Quem usa IA entrega mais em menos tempo.\n\nQuem ignora vai ficar para trás.\n\nVocê está do lado certo?\n\n#IA #futuro #infoproduto #automatizacao', image_prompt: 'Powerful quote design, bold white text on dark minimal background, AI concept 1:1' },
    { day: 19, pilar: 'bastidores',   formato: 'reel',      hook: 'Gravei 10 aulas em 1 dia usando IA. Veja o processo.', caption: 'Roteiro com IA → Gravação → Edição com IA.\n\nTimelapse do dia inteiro.\n\nO processo real sem glamour.\n\n#bastidores #producaodevideo #IA #infoproduto', image_prompt: 'Timelapse of content creation process, recording setup, multiple screens, productive creative workspace 9:16' },
    { day: 20, pilar: 'ia-aplicada',  formato: 'carrossel', hook: 'As 7 ferramentas de IA que uso no meu infoproduto — e quanto cada uma custa.', caption: 'Com valor real de cada uma.\n\nAlgumas custam menos de R$ 50/mês e valem ouro.\n\nSalva esse carrossel.\n\n#IA #ferramentas #infoproduto #automatizacao', image_prompt: 'Seven AI tools grid, app icons, price tags, professional tools comparison design 1:1' },
    { day: 21, pilar: 'resultado',    formato: 'reel',      hook: '3 semanas de funil perpétuo. Aqui estão os números reais.', caption: 'Dashboard aberto.\nNúmeros reais.\nO que funcionou e o que vou mudar.\n\nTransparência total.\n\n#resultados #funilperpertuo #infoproduto', image_prompt: 'Real analytics dashboard, 3 week results, conversion metrics visible, professional data 9:16' },
    { day: 22, pilar: 'sistemas',     formato: 'reel',      hook: 'O checkout que aumentou minha conversão em 40% sem mudar o produto.', caption: 'Order bump + checkout customizado + e-mail automático.\n\nTrês mudanças. Um resultado enorme.\n\nMostrando cada configuração.\n\n#checkout #conversao #infoproduto #vendas', image_prompt: 'Checkout page optimization, before and after conversion rate, e-commerce interface 9:16' },
    { day: 23, pilar: 'sistemas',     formato: 'carrossel', hook: 'Se você tem um infoproduto e não tem isso, está deixando dinheiro na mesa.', caption: '6 automações que a maioria dos infoprodutores não tem.\n\nCada uma tem impacto direto na receita.\n\nQual você não tem ainda?\n\n#automatizacao #infoproduto #sistema #receita', image_prompt: 'Money flowing through automation systems, digital funnel, profit visualization 1:1' },
    { day: 24, pilar: 'ia-aplicada',  formato: 'reel',      hook: 'Esse prompt de IA escreve sua sequência de e-mails pós-venda inteira.', caption: 'Prompt completo nos comentários.\n\n5 e-mails prontos em 10 minutos.\n\nCopiar, colar, personalizar e enviar.\n\n#emailmarketing #IA #prompts #infoproduto', image_prompt: 'Email sequence automation flow, five emails visualized, modern email marketing design 9:16' },
    { day: 25, pilar: 'provocacao',   formato: 'single',    hook: 'Infoprodutor que não tem sistema de retenção está enchendo o balde furado.', caption: 'Vender é a metade.\n\nManter o aluno engajado é a outra metade — e isso também pode ser automatizado.\n\nComo você retém seus alunos hoje?\n\n#retencao #alunos #infoproduto #engajamento', image_prompt: 'Leaking bucket metaphor, water flowing out, retention concept, bold minimalist 1:1' },
    { day: 26, pilar: 'bastidores',   formato: 'reel',      hook: 'O que muda na sua vida quando seu infoproduto vira uma máquina automática.', caption: 'Família. Praia. Liberdade.\n\nNão é sonho. É sistema.\n\nMostrando um dia da minha rotina com o produto funcionando sozinho.\n\n#liberdade #infoprodutor #lifestyle #empreendedorismo', image_prompt: 'Man at beach with laptop, freedom lifestyle, family in background, golden hour light 9:16' },
    { day: 27, pilar: 'resultado',    formato: 'carrossel', hook: '30 dias construindo um infoproduto com IA do zero. O que aprendi.', caption: 'Um aprendizado por slide.\n\nInclui os erros.\n\nO sistema está pronto. Agora é escalar.\n\n#30dias #infoproduto #IA #aprendizados', image_prompt: '30 days challenge summary, lessons learned cards, reflection design, timeline infographic 1:1' },
    { day: 28, pilar: 'sistemas',     formato: 'reel',      hook: 'Como eu vou escalar esse infoproduto para R$ 30k/mês usando só IA e tráfego pago.', caption: 'Mais criativos.\nNovos ângulos de copy.\nRemarketing.\nUpsell.\n\nTudo mapeado. Tudo executando.\n\n#escala #trafegopago #IA #infoproduto', image_prompt: 'Growth chart going up, scaling business concept, R$30k target visualization, bold design 9:16' },
    { day: 29, pilar: 'ia-aplicada',  formato: 'reel',      hook: 'Essa IA analisa seus anúncios e diz exatamente por que eles não convertem.', caption: 'Copy do anúncio → IA → análise + reescrita.\n\nDemonstração ao vivo.\n\nPrompt nos comentários.\n\n#IA #trafegopago #anuncio #copywriting', image_prompt: 'AI analyzing advertisement copy on screen, diagnostic interface, improvement suggestions 9:16' },
    { day: 30, pilar: 'resultado',    formato: 'reel',      hook: '30 dias. Um infoproduto. Uma máquina automática. Próximo passo?', caption: 'A jornada em 60 segundos.\n\nO Infomestre foi o sistema que estruturou tudo.\n\nLink na bio para acessar.\n\n#infomestre #infoproduto #IA #automatizacao #30dias', image_prompt: 'Journey summary montage, 30 day transformation, digital business success, cinematic 9:16' },
  ];

  const d0 = new Date(startDate);
  for (const p of POSTS) {
    const d = new Date(d0);
    d.setDate(d.getDate() + p.day - 1);
    store.posts.push({
      id: randomUUID(),
      hook: p.hook,
      caption: p.caption,
      pilar: p.pilar,
      formato: p.formato,
      status: 'rascunho',
      scheduled_date: d.toISOString().split('T')[0],
      image_url: null,
      image_prompt: p.image_prompt,
      corpo: '',
      cta: '',
      hashtags: '#infoproduto #automatizacao #IA #infomestre',
      notes: '',
      created_at: now,
      updated_at: now,
    });
  }
  persist();
}

// ── Post helpers ──────────────────────────────────────────
const db = {
  // Posts
  findPosts: (filters = {}) => {
    let list = [...store.posts];
    if (filters.status)  list = list.filter(p => p.status  === filters.status);
    if (filters.pilar)   list = list.filter(p => p.pilar   === filters.pilar);
    if (filters.formato) list = list.filter(p => p.formato === filters.formato);
    return list.sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || '') || a.created_at.localeCompare(b.created_at));
  },
  findById: (id) => store.posts.find(p => p.id === id) || null,
  insert: (data) => {
    const post = { id: randomUUID(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    store.posts.push(post);
    persist();
    return post;
  },
  update: (id, data) => {
    const idx = store.posts.findIndex(p => p.id === id);
    if (idx === -1) return null;
    store.posts[idx] = { ...store.posts[idx], ...data, updated_at: new Date().toISOString() };
    persist();
    return store.posts[idx];
  },
  remove: (id) => {
    const idx = store.posts.findIndex(p => p.id === id);
    if (idx === -1) return false;
    store.posts.splice(idx, 1);
    persist();
    return true;
  },
  stats: () => {
    const posts = store.posts;
    const byStatus = (s) => posts.filter(p => p.status === s).length;
    const byPilar  = [...new Set(posts.map(p => p.pilar))].map(pilar => ({ pilar, c: posts.filter(p => p.pilar === pilar).length }));
    const byFormato= [...new Set(posts.map(p => p.formato))].map(formato => ({ formato, c: posts.filter(p => p.formato === formato).length }));
    return { total: posts.length, rascunho: byStatus('rascunho'), 'em-producao': byStatus('em-producao'), pronto: byStatus('pronto'), agendado: byStatus('agendado'), postado: byStatus('postado'), byPilar, byFormato };
  },
  // Settings
  getSettings: () => ({ ...store.settings }),
  saveSettings: (data) => { Object.assign(store.settings, data); persist(); },
};

module.exports = db;
