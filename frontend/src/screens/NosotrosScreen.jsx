import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import { EYEBROW, SECTION } from '../components/uiStyles.js';
import { getInitials } from '../utils/initials.js';

// ─── EQUIPO (TEMPORAL) ───────────────────────────────────────────────────────
// Perfiles FICTICIOS autorizados mientras se presenta al equipo real. Para reemplazarlos
// basta con editar esta lista: las iniciales salen de `name` (getInitials) y `tone` da el color (sin fotos);
// si mas adelante hay retratos, agregar `photo` y mostrarlo en <TeamMember>.
const TEAM_MEMBERS = [
  { name: 'Santiago Alvarez', role: 'Dirección y contenidos', bio: 'Escucha al territorio y decide qué historias merecen quedarse.', tone: 'bg-river text-white' },
  { name: 'Camilo Giraldo', role: 'Desarrollo', bio: 'Construye la plataforma para que sea simple, rápida y de todos.', tone: 'bg-ink text-paper' },
  { name: 'Daniel Lopez', role: 'Diseño e identidad', bio: 'Traduce el río, el oro y la sabana en formas y colores.', tone: 'bg-orange text-white' },
  { name: 'Miguel Padilla', role: 'Comunidad y territorio', bio: 'Recorre los municipios y conecta a quienes hacen cultura.', tone: 'bg-mint text-ink' },
];

const PILLARS = [
  ['book', 'Historias'],
  ['calendar', 'Eventos'],
  ['sprout', 'Oportunidades'],
  ['mic', 'Talento'],
  ['drum', 'Cultura local'],
];

const PURPOSE = [
  ['Visibilizar', 'Que la tambora del domingo, la convocatoria de la biblioteca o el fotógrafo del barrio no se pierdan entre tantas pantallas.'],
  ['Conectar', 'Que quien organiza encuentre a quien quiere participar, y que un municipio conozca lo que pasa en el de al lado.'],
  ['Activar', 'Que descubrir algo termine en ir, aportar o crear. El territorio se mueve cuando la gente se encuentra.'],
];

const WAYS = [
  ['book', 'Cuenta una historia', 'Un oficio, una receta, una memoria del río: escríbenos y la contamos juntos.'],
  ['people', 'Conecta tu iniciativa', 'Si lideras un colectivo, una biblioteca o un emprendimiento, queremos darle lugar.'],
  ['calendar', 'Comparte un evento', 'Festivales, talleres, mercados y convocatorias que la gente debería conocer.'],
  ['compass', 'Fortalece lo local', 'Corrige un dato, propone un lugar o ayúdanos a llegar a otro municipio.'],
];

const H2 = 'font-sans text-[length:clamp(34px,4.2vw,56px)] font-extrabold leading-[1.02] tracking-[-0.045em] m-0 text-ink';
const LEAD = 'text-[18px] leading-[1.65] text-[#53645c] mt-5 mb-0';
const FIELD = 'w-full rounded-[14px] border border-[#d9cfbe] bg-[#fffdf8] py-3 px-4 text-[16px] text-ink outline-none transition-colors duration-200 placeholder:text-[#8a948f] focus:border-river focus:bg-white focus-visible:ring-2 focus-visible:ring-[rgba(29,143,163,0.25)]';
const LABEL = 'grid gap-2 text-[13px] font-bold text-ink';
const MAX_MESSAGE = 1000;

function TeamMember({ member }) {
  return (
    <article className="flex flex-col items-start">
      {/* Identidad temporal: iniciales + un aro desplazado, eco de los tres circulos de la marca. */}
      <div className="relative mb-5 size-[76px]" aria-hidden="true">
        <span className="absolute -right-2 -bottom-1.5 size-[76px] rounded-full border-2 border-ink/15" />
        <span className={`relative flex size-full items-center justify-center rounded-full text-[22px] font-extrabold tracking-[.02em] ${member.tone}`}>{getInitials(member.name)}</span>
      </div>
      <h3 className="m-0 font-sans text-[20px] font-bold tracking-[-0.02em] text-ink">{member.name}</h3>
      <p className="mt-1 mb-3 text-[11px] font-bold uppercase tracking-[.14em] text-river">{member.role}</p>
      <p className="m-0 text-[15px] leading-[1.55] text-[#53645c]">{member.bio}</p>
    </article>
  );
}

export default function NosotrosScreen() {
  const reduceMotion = useReducedMotion();
  const contactRef = useRef(null);
  const messageRef = useRef(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  // idle | loading | success | error
  const [status, setStatus] = useState({ type: 'idle' });

  // El endpoint publico de sugerencias solo guarda `message`: nombre y contacto (opcionales)
  // viajan como encabezado del mismo texto, asi el equipo los ve sin cambiar el backend.
  const composed = [name.trim() && `Nombre: ${name.trim()}`, contact.trim() && `Contacto: ${contact.trim()}`].filter(Boolean).join('\n');
  const fullMessage = composed ? `${composed}\n\n${message.trim()}` : message.trim();

  async function handleSubmit(event) {
    event.preventDefault();
    if (message.trim().length < 10) {
      setStatus({ type: 'error', text: 'Escribe un mensaje de al menos 10 caracteres.' });
      messageRef.current?.focus();
      return;
    }
    if (fullMessage.length > MAX_MESSAGE) {
      setStatus({ type: 'error', text: `El mensaje no puede superar ${MAX_MESSAGE} caracteres.` });
      return;
    }
    setStatus({ type: 'loading' });
    try {
      const token = localStorage.getItem('tejido_token');
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: fullMessage }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No pudimos enviar tu mensaje.');
      setStatus({ type: 'success', ticket: result.ticket });
      setName('');
      setContact('');
      setMessage('');
    } catch (sendError) {
      const offline = sendError instanceof TypeError;
      setStatus({ type: 'error', text: offline ? 'No pudimos enviar tu mensaje. Revisa tu conexión e inténtalo de nuevo.' : sendError.message });
    }
  }

  // "Conviertete en colaborador": lleva al formulario con una primera linea sugerida.
  function inviteToCollaborate() {
    setStatus({ type: 'idle' });
    setMessage((current) => current || 'Quiero colaborar con TEJIDO. ');
    contactRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => messageRef.current?.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
  }

  const loading = status.type === 'loading';

  return (
    <div className="pb-10">
      {/* 1. Que es TEJIDO */}
      <section className={`${SECTION} grid grid-cols-[1.15fr_1fr] gap-16 [align-items:end] max800:grid-cols-[1fr] max800:gap-8`}>
        <div>
          <p className={EYEBROW}>Qué es TEJIDO</p>
          <h1 className="m-0 font-sans text-[length:clamp(42px,5.4vw,78px)] font-extrabold leading-[.98] tracking-[-0.055em] text-ink">
            Un lugar para descubrir lo que <em className="font-display italic font-bold text-purple">se teje</em> en el Bajo Cauca.
          </h1>
        </div>
        <div>
          <p className="m-0 text-[18px] leading-[1.65] text-[#53645c]">
            TEJIDO es una plataforma de descubrimiento territorial para Caucasia y el Bajo Cauca. Reúne en un solo lugar lo que pasa en sus calles, sus riberas y sus veredas, para que encontrarlo sea tan fácil como preguntarle a un vecino.
          </p>
          <ul className="mt-7 mb-0 flex list-none flex-wrap gap-2 p-0">
            {PILLARS.map(([icon, label]) => (
              <li key={label} className="inline-flex items-center gap-2 rounded-full border border-[#d9cfbe] py-2 px-3.5 text-[14px] font-semibold text-ink">
                <Icon name={icon} className="size-[18px] text-river" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. Nuestro proposito */}
      <section className="mx-[4vw] rounded-[40px] bg-cream py-[90px] px-[8vw] max800:py-[64px] max800:px-[6vw]">
        <p className={EYEBROW}>Nuestro propósito</p>
        <h2 className={`${H2} max-w-[820px]`}>Que lo que pasa aquí se vea, se encuentre y <em className="font-display italic font-bold text-orange">se mueva</em>.</h2>
        <ol className="mt-14 mb-0 grid list-none grid-cols-[repeat(3,1fr)] gap-10 p-0 max800:mt-10 max800:grid-cols-[1fr] max800:gap-8">
          {PURPOSE.map(([verb, text], index) => (
            <li key={verb} className="border-t border-t-[rgba(23,63,54,0.18)] pt-5">
              <span className="block text-[12px] font-bold tracking-[.16em] text-[#6a7c75]">0{index + 1}</span>
              <h3 className="mt-2 mb-3 font-sans text-[26px] font-extrabold tracking-[-0.03em] text-ink">{verb}</h3>
              <p className="m-0 text-[16px] leading-[1.6] text-[#44564f]">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. El equipo (unica revelacion animada de la pantalla) */}
      <section className={SECTION}>
        <div className="mb-12 flex [align-items:end] justify-between gap-8 max800:flex-col max800:items-start max800:gap-4">
          <div>
            <p className={EYEBROW}>El equipo detrás de TEJIDO</p>
            <h2 className={`${H2} max-w-[640px]`}>Gente de aquí, tejiendo con lo de aquí.</h2>
          </div>
          <p className="m-0 max-w-[300px] text-[13px] leading-[1.5] text-[#6a7c75]">Perfiles de muestra mientras presentamos al equipo real.</p>
        </div>
        <motion.div
          className="grid grid-cols-[repeat(4,1fr)] gap-10 max1024:grid-cols-[repeat(2,1fr)] max600:grid-cols-[1fr] max600:gap-9"
          initial={reduceMotion ? false : 'hidden'}
          whileInView="shown"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ shown: { transition: { staggerChildren: 0.09 } } }}
        >
          {TEAM_MEMBERS.map((member) => (
            <motion.div key={member.name} variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}>
              <TeamMember member={member} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* 4. Comunicate con nosotros */}
      <section ref={contactRef} className={`${SECTION} scroll-mt-24 grid grid-cols-[1fr_1.1fr] gap-16 border-t border-t-line max800:grid-cols-[1fr] max800:gap-10`} aria-labelledby="contacto-titulo">
        <div>
          <p className={EYEBROW}>Comunícate con nosotros</p>
          <h2 id="contacto-titulo" className={H2}>Escríbenos.</h2>
          <p className={LEAD}>Una idea, una corrección, una historia que no hemos contado o las ganas de sumarte. Tu mensaje llega directo al equipo de TEJIDO.</p>
          <p className="mt-6 mb-0 inline-flex items-center gap-2 text-[13px] text-[#6a7c75]">
            <Icon name="inbox" className="size-4" /> No publicamos tu nombre ni tus datos de contacto.
          </p>
        </div>

        {status.type === 'success' ? (
          <div className="self-start rounded-[24px] border border-[rgba(29,143,163,0.3)] bg-[rgba(29,143,163,0.06)] p-8" role="status">
            <Icon name="check" className="size-8 text-river" />
            <h3 className="mt-4 mb-2 font-sans text-[24px] font-extrabold tracking-[-0.03em] text-ink">Mensaje recibido</h3>
            <p className="m-0 text-[16px] leading-[1.6] text-[#44564f]">
              Gracias por escribirnos. {status.ticket && <>Tu número de seguimiento es <strong className="text-ink">{status.ticket}</strong>.</>}
            </p>
            <button type="button" className="mt-6 cursor-pointer rounded-full border border-ink bg-transparent py-2.5 px-5 text-[14px] font-bold text-ink transition-colors duration-200 hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onClick={() => setStatus({ type: 'idle' })}>
              Escribir otro mensaje
            </button>
          </div>
        ) : (
          <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-[1fr_1fr] gap-5 max600:grid-cols-[1fr]">
              <label className={LABEL}>
                Tu nombre <span className="sr-only">(opcional)</span>
                <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Opcional" />
              </label>
              <label className={LABEL}>
                Cómo contactarte <span className="sr-only">(opcional)</span>
                <input className={FIELD} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Correo o teléfono, opcional" />
              </label>
            </div>
            <label className={LABEL}>
              Mensaje
              <textarea ref={messageRef} className={`${FIELD} min-h-[160px] resize-y leading-[1.55]`} value={message} onChange={(e) => setMessage(e.target.value)} required aria-describedby="contacto-ayuda" placeholder="Cuéntanos en qué estás pensando..." />
            </label>
            <div className="flex items-center justify-between gap-4 text-[12px] text-[#6a7c75]" id="contacto-ayuda">
              <span>Mínimo 10 caracteres.</span>
              <span className={fullMessage.length > MAX_MESSAGE ? 'font-bold text-[#b3442b]' : ''}>{fullMessage.length} / {MAX_MESSAGE}</span>
            </div>
            {status.type === 'error' && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{status.text}</p>}
            <button type="submit" disabled={loading} className="inline-flex cursor-pointer items-center justify-center gap-2 justify-self-start rounded-full border-0 bg-ink py-4 px-7 text-[16px] font-bold text-white transition-colors duration-200 hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-65 max600:justify-self-stretch">
              <Icon name="send" className="size-[18px]" />
              {loading ? 'Enviando...' : 'Enviar mensaje'}
            </button>
          </form>
        )}
      </section>

      {/* 5. Colabora con TEJIDO */}
      <section className={`${SECTION} pt-0 max800:pt-0`}>
        <div className="rounded-[40px] border border-[#e2d9ca] bg-[#fffaf2] py-[70px] px-[6vw] max800:py-12 max800:px-6">
          <p className={EYEBROW}>Colabora con TEJIDO</p>
          <h2 className={`${H2} max-w-[760px]`}>El tejido crece con cada hilo que se suma.</h2>
          <ul className="mt-12 mb-0 grid list-none grid-cols-[repeat(4,1fr)] gap-8 p-0 max1024:grid-cols-[repeat(2,1fr)] max600:grid-cols-[1fr]">
            {WAYS.map(([icon, title, text]) => (
              <li key={title}>
                <Icon name={icon} className="size-7 text-river" />
                <h3 className="mt-4 mb-2 font-sans text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</h3>
                <p className="m-0 text-[15px] leading-[1.55] text-[#53645c]">{text}</p>
              </li>
            ))}
          </ul>
          <button type="button" onClick={inviteToCollaborate} className="mt-12 inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-orange py-4 px-7 text-[18px] font-bold text-white transition-colors duration-200 hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange">
            Conviértete en colaborador
            <Icon name="arrow-right" className="size-[18px]" />
          </button>
        </div>
      </section>
    </div>
  );
}
