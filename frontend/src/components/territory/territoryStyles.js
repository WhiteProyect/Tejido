// Clases del rediseño de Agenda y Oportunidades (entrada, filtros, barras, tarjetas, estados). Los
// colores vienen de uiStyles.js (TERRITORY y variantes): aqui solo forma, espacios y tamaños.
// Cortes: escritorio >= 1024 px, tablet 768-1023 px, movil < 768 px. Sin degradados.
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#173f36]';

export const TS = {
  focus: FOCUS,
  page: 'mx-auto w-full max-w-[1300px] px-10 pt-14 pb-24 max-[1023px]:max-w-[768px] max-[1023px]:px-6 max-[767px]:px-4 max-[767px]:pt-8 max-[767px]:pb-16',

  // Entrada
  hero: 'grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-end gap-10 rounded-[24px] bg-[#f3e4c8] p-10 max-[1023px]:grid-cols-[minmax(0,1fr)] max-[1023px]:gap-4 max-[1023px]:p-7 max-[767px]:p-5',
  // Ocre de texto (TERRITORY.ochreText): el #b8502b no llega a 4,5:1 sobre la caja crema.
  kicker: 'm-0 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#a44727]',
  heroTitle: 'mt-3 mb-0 font-sans text-[40px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#173f36] [overflow-wrap:anywhere] max-[1023px]:text-[32px] max-[767px]:text-[26px]',
  heroItalic: 'font-display font-bold italic',
  heroText: 'm-0 text-[17px] leading-[1.55] text-[#3f514a] max-[767px]:text-[16px]',

  // Filtros
  filters: 'mt-6 rounded-[18px] border border-[#ddd5c7] bg-white p-4',
  filtersRow: 'flex items-end gap-4 max-[1023px]:flex-col max-[1023px]:items-stretch',
  selects: 'grid flex-1 gap-4 [grid-template-columns:repeat(var(--cols),minmax(0,1fr))]',
  toggles: 'flex shrink-0 flex-wrap items-center gap-3',
  field: 'grid min-w-0 gap-1.5',
  fieldLabel: 'text-[13px] font-bold uppercase tracking-[.1em] text-[#3f514a]',
  select: `h-11 w-full cursor-pointer appearance-none rounded-[12px] border border-[#ddd5c7] bg-white py-0 pr-10 pl-3.5 font-sans text-[16px] font-medium text-[#173f36] outline-none focus:border-[#173f36] ${FOCUS}`,
  switchBtn: `flex min-h-11 cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent px-1 font-sans text-[16px] font-semibold text-[#173f36] ${FOCUS}`,
  switchTrack: 'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-200',
  switchOn: 'border-[#173f36] bg-[#173f36]',
  switchOff: 'border-[#4d5a55] bg-[#f3e4c8]',
  switchThumb: 'absolute size-5 rounded-full bg-white [box-shadow:0_1px_3px_rgba(0,0,0,.3)] transition-[left] duration-200 motion-reduce:transition-none',
  clear: `min-h-11 cursor-pointer rounded-full border-0 bg-transparent px-2 font-sans text-[15px] font-bold text-[#173f36] underline decoration-[#ddd5c7] decoration-2 underline-offset-4 hover:decoration-[#173f36] ${FOCUS}`,
  // Movil: boton Filtros fijo + fila de pildoras con desplazamiento horizontal.
  mobileBar: 'mt-5 flex items-center gap-2 rounded-[18px] border border-[#ddd5c7] bg-white p-2',
  mobileFilterBtn: `relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border-0 bg-[#173f36] px-4 font-sans text-[15px] font-bold text-[#fff9ec] ${FOCUS}`,
  mobileScroller: 'flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  togglePill: `inline-flex min-h-11 shrink-0 snap-start cursor-pointer items-center gap-2 rounded-full border border-[#173f36] px-4 font-sans text-[15px] font-semibold ${FOCUS}`,
  togglePillOn: 'bg-[#173f36] text-[#fff9ec]',
  togglePillOff: 'bg-white text-[#173f36]',
  sheetBackdrop: 'fixed inset-0 z-[85] bg-[rgba(12,36,30,.5)]',
  sheet: 'fixed inset-x-0 bottom-0 z-[86] max-h-[88vh] overflow-y-auto rounded-t-[24px] border-t-2 border-[#173f36] bg-[#fff9ec] px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]',
  sheetGrip: 'mx-auto mb-4 block h-1.5 w-12 rounded-full bg-[#ddd5c7]',
  sheetTitle: 'm-0 mb-4 font-sans text-[22px] font-extrabold text-[#173f36]',
  btnSolid: `inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-[#173f36] px-6 font-sans text-[16px] font-bold text-[#fff9ec] no-underline hover:bg-[#2d5a3d] ${FOCUS}`,
  btnCream: `inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-[#f3e4c8] px-6 font-sans text-[16px] font-bold text-[#173f36] no-underline hover:bg-[#ead7b3] ${FOCUS}`,
  btnOutline: `inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-[#173f36] bg-white px-5 font-sans text-[16px] font-bold text-[#173f36] no-underline hover:bg-[#f3e4c8] ${FOCUS}`,
  btnDisabled: 'inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-full border-0 bg-[#ddd5c7] px-6 font-sans text-[16px] font-bold text-[#173f36]',
  count: 'mt-5 mb-0 min-h-[22px] text-[15px] font-semibold text-[#3f514a]',

  // Barras de bloque (todo el ancho, mayusculas con espaciado).
  bar: 'm-0 flex min-h-12 items-center rounded-[14px] px-5 py-3 font-sans text-[14px] font-extrabold uppercase leading-[1.3] tracking-[.14em] [overflow-wrap:anywhere]',
  block: 'mt-12 first:mt-8',
  monthBar: 'mt-8',

  // Cuadricula: 2 columnas (gap-6), tablet 2 compactas (gap-4), movil 1.
  grid: 'm-0 mt-5 grid list-none grid-cols-[repeat(2,minmax(0,1fr))] gap-6 p-0 max-[1023px]:gap-4 max-[767px]:grid-cols-[minmax(0,1fr)]',
  cell: 'flex min-w-0',

  // Tarjeta (comun)
  card: 'flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#ddd5c7] bg-white text-[#173f36] no-underline',
  cardHover: 'transition-[border-color,box-shadow] duration-200 hover:border-[#173f36] hover:[box-shadow:0_10px_26px_rgba(23,63,54,.12)] motion-reduce:transition-none',
  cardMuted: 'bg-[#f3e4c8]',
  media: 'relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[#f3e4c8] max-[1023px]:aspect-auto max-[1023px]:h-[180px] max-[767px]:aspect-[16/9] max-[767px]:h-auto',
  image: 'block size-full object-cover',
  noImage: 'flex size-full min-h-[120px] items-center justify-center text-[#4d5a55]',
  band: 'flex flex-wrap items-center gap-2 px-5 py-3 max-[1023px]:px-4',
  body: 'flex flex-1 flex-col gap-3 p-5 max-[1023px]:p-4',
  title: 'm-0 font-sans text-[21px] font-extrabold leading-[1.2] tracking-[-0.01em] [overflow-wrap:anywhere] max-[1023px]:text-[19px]',
  summary: 'm-0 line-clamp-3 text-[15px] leading-[1.5] [overflow-wrap:anywhere]',
  dateBox: 'm-0 rounded-[10px] border-l-4 bg-[#f3e4c8] px-4 py-2.5 text-[15px] font-bold leading-[1.4] [overflow-wrap:anywhere]',
  place: 'mt-auto mb-0 text-[15px] font-bold leading-[1.4] [overflow-wrap:anywhere]',

  // Hilo y estados
  hiloCard: 'flex w-full flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-[#ddd5c7] bg-[#fff9ec] p-6 text-center',
  hiloEmpty: 'mx-auto mt-8 flex max-w-[560px] flex-col items-center gap-3 rounded-[24px] border border-[#ddd5c7] bg-white p-8 text-center max-[767px]:p-6',
  hiloImg: 'h-auto w-[120px]',
  hiloTitle: 'm-0 font-sans text-[22px] font-extrabold leading-[1.2] text-[#173f36]',
  hiloText: 'm-0 max-w-[420px] text-[15px] leading-[1.5] text-[#3f514a]',
  error: 'mt-8 rounded-[20px] border-2 border-[#d85b36] bg-white p-6 text-center',
  errorTitle: 'm-0 text-[18px] font-extrabold text-[#173f36]',
  notice: 'mt-6 mb-0 rounded-[14px] border border-[#ddd5c7] bg-[#f3e4c8] px-5 py-4 text-[16px] font-semibold leading-[1.45] text-[#173f36]',
  skeleton: 'overflow-hidden rounded-[20px] border border-[#ddd5c7] bg-[#fff9ec]',
  skeletonBlock: 'rounded-[8px] bg-[#f3e4c8] motion-safe:animate-pulse motion-safe:[animation-duration:2.4s]',
};
