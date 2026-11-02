// Estado vacio de las pantallas de municipio: Hilo invita a sugerir una historia o un talento y
// lleva al formulario de Nosotros (el unico formulario de sugerencias). Deja una primera linea en
// sessionStorage (CONTACT_DRAFT_KEY) que Nosotros pone en el mensaje al abrirse, y baja al formulario.
export const CONTACT_DRAFT_KEY = 'tejido_contacto_borrador';

export default function SuggestNote({ title, text, draft }) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-dashed border-[#d9cfbe] bg-[#fffaf2] p-6 max480:p-5">
      <img src="/images/hilo/hilo-senala.png" alt="" width="88" height="88" className="size-[88px] shrink-0 object-contain" loading="lazy" decoding="async" />
      <div className="min-w-0 flex-1 basis-[240px]">
        <p className="m-0 text-[17px] font-bold text-ink">{title}</p>
        <p className="mt-1 mb-0 text-[15px] leading-[1.55] text-[#53645c]">{text}</p>
        <a
          href="#nosotros"
          onClick={() => { try { sessionStorage.setItem(CONTACT_DRAFT_KEY, draft); } catch { /* sin almacenamiento: abre el formulario vacio */ } }}
          className="mt-4 inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink py-2 px-5 text-[14px] font-bold text-ink no-underline transition-colors duration-200 hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Sugerir a TEJIDO
        </a>
      </div>
    </div>
  );
}
