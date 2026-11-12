import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, Reorder, motion, useDragControls, useReducedMotion } from 'framer-motion';
import CarouselPicker, { StateChip, Thumb } from './CarouselPicker.jsx';
import { LIMIT_KEYS, SELLO_LABELS, fromServer, itemKey, meta, sameDraft, withLimits } from './carouselItems.js';
import Icon from '../../Icon.jsx';
import { ConfirmDialog } from '../../gestor/edit/common.jsx';
import { BTN_GHOST, BTN_INK_MD, BTN_INK_OUTLINE_MD, PANEL, PANEL_TITLE } from '../../uiStyles.js';
import { DragHandle, ICON_BTN, MoveButtons, moveFocus, moveItem } from '../SortableControls.jsx';
import { useUnsavedChanges } from '../artist/unsavedChanges.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { apiRequest } from '../../../utils/api.js';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';

// Carrusel del inicio (#admin-dashboard/carrusel): GET/PUT/DELETE /api/admin/home-carousel. El admin fija
// cuantas diapositivas van de contenido, de Moneystack y de TEJIDO, y elige y ordena lo que sale primero
// (dos listas: Contenido y Artistas). Lo que no elija lo completa el carrusel automatico. Cada fila dice si
// sale o por que no (fuera de vigencia, no publicada, rama desactivada, sin imagen, fuera del limite): no
// se borra sola. "Fuera del limite" se recalcula al editar; lo demas lo calcula el backend al leer.
// La vista previa es lo GUARDADO (el mismo builder del publico). Reordenar: asa de arrastre o Subir/Bajar
// (SortableControls, igual que el Pulso), con un aviso aria-live.
const API = '/api/admin/home-carousel';
const LIMIT_INFO = {
  content_limit: { label: 'Contenido', short: 'de contenido', color: '#173f36' },
  moneystack_limit: { label: 'Moneystack', short: 'de Moneystack', color: '#b8902a' },
  tejido_limit: { label: 'TEJIDO', short: 'de TEJIDO', color: '#1d8fa3' },
};
const EASE = [0.22, 1, 0.36, 1];
const SECTION_TITLE = 'm-0 flex items-center gap-2.5 font-sans text-[20px] font-bold tracking-[-0.02em] text-ink';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Stepper({ name, value, min, max, onChange }) {
  const info = LIMIT_INFO[name];
  const id = useId();
  const set = (next) => onChange(Math.min(max, Math.max(min, next)));
  function onKeyDown(event) {
    const keys = { ArrowUp: value + 1, ArrowRight: value + 1, ArrowDown: value - 1, ArrowLeft: value - 1, PageUp: value + 3, PageDown: value - 3, Home: min, End: max };
    if (event.key in keys) { event.preventDefault(); set(keys[event.key]); }
  }
  return (
    <div className="grid gap-1.5 rounded-[18px] border border-[#e2d9ca] bg-white p-3" data-contador={name}>
      <span id={`${id}-l`} className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.12em] text-[#53645c]">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: info.color }} aria-hidden="true" />{info.label}
      </span>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={ICON_BTN} aria-label={`Menos ${info.short}`} disabled={value <= min} onClick={() => set(value - 1)} data-menos>
          <Icon name="minus" className="size-4" strokeWidth={2.2} />
        </button>
        <span role="spinbutton" tabIndex={0} aria-labelledby={`${id}-l`} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
          aria-valuetext={`${value} ${info.short}`} onKeyDown={onKeyDown} data-valor
          className="min-w-12 rounded-[10px] px-2 text-center font-sans text-[28px] font-extrabold tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          {value}
        </span>
        <button type="button" className={ICON_BTN} aria-label={`Más ${info.short}`} disabled={value >= max} onClick={() => set(value + 1)} data-mas>
          <Icon name="plus" className="size-4" strokeWidth={2.2} />
        </button>
      </div>
      <span className="text-[12px] text-[#6a7c75]">Entre {min} y {max}</span>
    </div>
  );
}

function Amounts({ settings, ranges, onChange }) {
  const total = LIMIT_KEYS.reduce((sum, key) => sum + settings[key], 0);
  return (
    <section className="grid gap-4" aria-labelledby="carrusel-cantidades">
      <h3 id="carrusel-cantidades" className={SECTION_TITLE}><Icon name="sliders" className="size-5 text-river" /> Cantidades</h3>
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 max600:grid-cols-[minmax(0,1fr)]">
        {LIMIT_KEYS.map((key) => (
          <Stepper key={key} name={key} value={settings[key]} min={ranges[key][0]} max={ranges[key][1]} onChange={(value) => onChange({ ...settings, [key]: value })} />
        ))}
      </div>
      <div className="grid gap-2">
        <p className="m-0 text-[15px] text-ink" aria-live="polite" data-total>
          <strong>Hasta {plural(total, 'diapositiva', 'diapositivas')}</strong>
          <span className="text-[#53645c]"> · {LIMIT_KEYS.map((key) => `${settings[key]} ${LIMIT_INFO[key].short}`).join(' · ')}</span>
        </p>
        {/* Proporcion: tres tramos solidos, sin degradados. */}
        <div className="flex h-3 overflow-hidden rounded-full bg-[#efe6d6]" aria-hidden="true" data-proporcion>
          {total > 0 && LIMIT_KEYS.map((key) => settings[key] > 0 && (
            <span key={key} className="h-full transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(settings[key] / total) * 100}%`, backgroundColor: LIMIT_INFO[key].color }} />
          ))}
        </div>
        {total === 0 && <p className="m-0 text-[14px] font-semibold text-[#b3442b]" role="alert" data-total-cero>El carrusel no puede quedar vacío: sube alguna cantidad.</p>}
        <p className="m-0 text-[13px] text-[#53645c]">Son máximos: si falta contenido o artistas, salen menos. Cada artista sale una sola vez.</p>
      </div>
    </section>
  );
}

function PickRow({ item, index, total, onMove, onRemove, onDragEnd }) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  const key = itemKey(item);
  const dim = item.status !== 'VISIBLE';
  return (
    <Reorder.Item value={key} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} data-elegido={key}
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -24, transition: { duration: 0.18 } }}
      transition={{ duration: reduce ? 0 : 0.24, ease: EASE }}
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[16px] border border-[#ddd5c7] bg-[#fffdf6] py-2 pr-2 pl-1 [box-shadow:0_1px_2px_rgba(23,63,54,.06)]">
      <DragHandle controls={controls} label={item.title} />
      <div className={`flex min-w-0 flex-1 basis-[220px] items-center gap-3 ${dim ? 'opacity-60' : ''}`} data-atenuada={dim || undefined}>
        <span className="w-6 shrink-0 text-center text-[13px] font-bold tabular-nums text-[#6a7c75]" aria-hidden="true">{index + 1}</span>
        <Thumb item={item} />
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-bold leading-[1.25] text-ink [overflow-wrap:anywhere]">{item.title}</p>
          <p className="m-0 text-[13px] text-[#53645c]">{meta(item)}</p>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#3f514a]">
            <StateChip item={item} /><span data-motivo>{item.reason}</span>
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <MoveButtons label={item.title} index={index} total={total} onMove={onMove} />
        <button type="button" className={`${BTN_GHOST} min-h-11`} onClick={onRemove} aria-label={`Quitar «${item.title}»`} data-quitar>Quitar</button>
      </div>
    </Reorder.Item>
  );
}

function PickList({ name, title, icon, help, items, onChange, onAdd, announce }) {
  const listRef = useRef(null);
  const keys = items.map(itemKey);
  const byKey = Object.fromEntries(items.map((item) => [itemKey(item), item]));

  function move(item, delta) {
    const next = moveItem(items, keys.indexOf(itemKey(item)), delta);
    if (!next) return;
    onChange(next);
    announce(`«${item.title}» movido a la posición ${next.indexOf(item) + 1} de ${next.length}.`);
    moveFocus(() => listRef.current?.querySelector(`[data-elegido="${itemKey(item)}"]`), delta);
  }

  function remove(item) {
    const index = keys.indexOf(itemKey(item));
    const rest = items.filter((other) => other !== item);
    onChange(rest);
    announce(`«${item.title}» quitado de ${title}.`);
    // El foco pasa a la fila que ocupa su lugar (o a "Agregar" si la lista queda vacia).
    const neighbour = rest[Math.min(index, rest.length - 1)];
    requestAnimationFrame(() => {
      const section = document.querySelector(`[data-seccion="${name}"]`);
      const target = neighbour && section?.querySelector(`[data-elegido="${itemKey(neighbour)}"] [data-quitar]`);
      (target || section?.querySelector('[data-abrir-selector]'))?.focus();
    });
  }

  return (
    <section className="grid content-start gap-3" aria-labelledby={`carrusel-${name}`} data-seccion={name}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`carrusel-${name}`} className={SECTION_TITLE}><Icon name={icon} className="size-5 text-river" /> {title}
            <span className="rounded-full bg-[#f3e4c8] px-2.5 py-0.5 text-[13px] font-bold tabular-nums">{items.length}</span>
          </h3>
          <p className="mt-1 mb-0 text-[14px] text-[#53645c]">{help}</p>
        </div>
        <button type="button" className={`${BTN_INK_OUTLINE_MD}`} onClick={onAdd} data-abrir-selector><Icon name="plus" className="size-4" /> Agregar</button>
      </div>
      {items.length ? (
        <Reorder.Group ref={listRef} axis="y" values={keys} onReorder={(next) => onChange(next.map((key) => byKey[key]))}
          className="m-0 grid list-none gap-2 p-0" aria-label={`${title}, en orden`} data-lista={name}>
          <AnimatePresence initial={false}>
            {items.map((item, index) => (
              <PickRow key={itemKey(item)} item={item} index={index} total={items.length} onMove={(delta) => move(item, delta)} onRemove={() => remove(item)}
                onDragEnd={() => announce(`«${item.title}» movido a la posición ${items.indexOf(item) + 1} de ${items.length}.`)} />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      ) : (
        <p ref={listRef} className="m-0 rounded-[16px] border border-dashed border-[#d9cfbe] py-4 px-4 text-[14px] text-[#53645c]" data-lista-vacia={name}>
          Nada elegido: sale lo automático.
        </p>
      )}
    </section>
  );
}

function PreviewStrip({ slides, dirty }) {
  return (
    <section className="grid gap-3" aria-labelledby="carrusel-vista-previa">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id="carrusel-vista-previa" className={SECTION_TITLE}><Icon name="carousel" className="size-5 text-river" /> Así se ve ahora</h3>
        <span className="rounded-full bg-[#dcefe5] px-2.5 py-0.5 text-[12px] font-bold text-[#245a43]">{plural(slides.length, 'diapositiva', 'diapositivas')}</span>
      </div>
      {dirty && (
        <p className="m-0 rounded-[14px] bg-[#f6ebcc] py-2.5 px-4 text-[14px] text-[#5f4a10]" role="status" data-aviso-sin-guardar>
          Tienes cambios sin guardar: la vista previa muestra lo guardado hasta que guardes.
        </p>
      )}
      {slides.length ? (
        <ol className="m-0 flex list-none snap-x gap-3 overflow-x-auto p-0 pb-2" aria-label="Diapositivas guardadas, en orden" data-vista-previa>
          {slides.map((slide, index) => {
            const artist = slide.type === 'ARTIST';
            const label = artist ? (slide.sello === 'TEJIDO' ? 'Artista · TEJIDO' : 'Artista · Moneystack') : slide.badge.split(' · ')[0];
            return (
              <li key={`${slide.key}-${index}`} className="w-[150px] shrink-0 snap-start" data-diapositiva={slide.key}>
                <div className={`relative aspect-[4/5] overflow-hidden rounded-[14px] ${artist ? 'bg-[#0d0f0e]' : 'bg-[#efe6d6]'}`}>
                  {slide.image && <img src={cdnImage(slide.image, { width: 300 })} alt="" className="size-full object-cover" loading="lazy" />}
                  <span className="absolute top-2 left-2 rounded-full bg-[#fffaf2] px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink">{index + 1}</span>
                </div>
                <p className={`m-0 mt-1.5 text-[11px] font-bold uppercase tracking-[.08em] ${artist ? 'text-[#7a5c12]' : 'text-[#146f80]'}`}>{label}</p>
                <p className="m-0 text-[13px] font-semibold leading-[1.3] text-ink line-clamp-2">{slide.title}</p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="m-0 rounded-[14px] bg-[#f6efe2] py-3 px-4 text-[14px] text-[#53645c]">Con lo guardado no sale ninguna diapositiva.</p>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 grid gap-4" aria-busy="true" aria-label="Cargando el carrusel">
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 max600:grid-cols-[minmax(0,1fr)]">
        {[0, 1, 2].map((i) => <div key={i} className="h-[118px] rounded-[18px] bg-[#f3ece0] motion-safe:animate-pulse" />)}
      </div>
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-[76px] rounded-[16px] bg-[#f3ece0] motion-safe:animate-pulse" />)}
    </div>
  );
}

export default function CarouselPanel() {
  const { showToast } = useToast();
  const reduce = useReducedMotion();
  const [saved, setSaved] = useState(null); // respuesta de la API (lo guardado)
  const [draft, setDraft] = useState(null); // { settings, content, artists } en edicion
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(null); // 'content' | 'artists'
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState('');

  const apply = useCallback((data) => {
    setSaved(data);
    setDraft({ settings: { ...data.settings }, content: data.content.map(fromServer), artists: data.artists.map(fromServer) });
  }, []);

  useEffect(() => {
    apiRequest(API).then(apply).catch((loadError) => {
      setError(loadError.message);
      showToast({ tone: 'naranja', title: 'No se pudo cargar el carrusel', text: loadError.message });
    });
  }, [apply]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedDraft = saved && { settings: saved.settings, content: saved.content, artists: saved.artists };
  const dirty = Boolean(draft && !sameDraft(draft, savedDraft));
  useUnsavedChanges(dirty);

  const total = draft ? LIMIT_KEYS.reduce((sum, key) => sum + draft.settings[key], 0) : 0;
  const view = draft && withLimits(draft.content, draft.artists, draft.settings);
  const announce = (text) => setMessage(text);

  async function run(request, success) {
    setBusy(true);
    try {
      apply(await request());
      showToast({ tone: 'menta', ...success });
      return true;
    } catch (saveError) {
      showToast({ tone: 'naranja', title: 'No se pudo guardar', text: saveError.message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => apiRequest(API, {
    method: 'PUT',
    body: {
      settings: draft.settings,
      content: draft.content.map(({ type, id }) => ({ type, id })),
      artists: draft.artists.map(({ type, id }) => ({ type, id })),
    },
  }), { eyebrow: 'Carrusel', title: 'Cambios guardados', text: 'El inicio ya muestra el carrusel nuevo.' });

  function cancel() {
    apply(saved);
    announce('Cambios descartados.');
  }

  async function reset() {
    setConfirmReset(false);
    await run(() => apiRequest(API, { method: 'DELETE' }),
      { eyebrow: 'Carrusel', title: 'Volvió a automático', text: '10 de contenido, 3 de Moneystack y 3 de TEJIDO, sin elegidos.' });
  }

  function add(section, item) {
    const entry = fromServer(item);
    setDraft((current) => ({ ...current, [section]: [...current[section], entry] }));
    announce(`«${item.title}» agregado al final de ${section === 'content' ? 'Contenido' : 'Artistas'}.`);
  }

  const restorable = (section) => {
    if (!saved || !draft) return [];
    const kept = new Set(draft[section].map(itemKey));
    return saved[section].filter((item) => !kept.has(itemKey(item))).map((item) => ({ ...item, status: item.status === 'FUERA_DEL_LIMITE' ? 'VISIBLE' : item.status }));
  };

  return (
    <MotionConfig reducedMotion="user">
      <section className={PANEL} aria-labelledby="admin-carrusel" data-panel-carrusel>
        <div className="max-w-[720px]">
          <h2 id="admin-carrusel" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="carousel" className="size-6 text-river" /> Carrusel del inicio</h2>
          <p className="mt-2 mb-0 text-[15px] text-muted">
            Elige qué sale primero y en qué orden. Lo que no elijas lo completa el carrusel automático: una publicación por rama, un talento y los artistas destacados. Lo que deja de estar vigente se salta solo y vuelve si vuelve a valer.
          </p>
        </div>

        {error && !saved && <p className="mt-6 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[15px] text-[#b3442b]" role="alert">{error}</p>}
        {!saved && !error && <Skeleton />}
        {saved && draft && (
          <motion.div className="mt-8 grid gap-10" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}>
            <Amounts settings={draft.settings} ranges={saved.ranges} onChange={(settings) => setDraft({ ...draft, settings })} />

            <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
              <PickList name="contenido" title="Contenido" icon="book" items={view.content} announce={announce}
                help="Publicaciones (historias, eventos, oportunidades, iniciativas y lugares) y perfiles de talento."
                onChange={(content) => setDraft({ ...draft, content })} onAdd={() => setPicker('content')} />
              <PickList name="artistas" title="Artistas" icon="music" items={view.artists} announce={announce}
                help={`De ${SELLO_LABELS.MONEYSTACK} y de ${SELLO_LABELS.TEJIDO}. Cada sello respeta su cantidad.`}
                onChange={(artists) => setDraft({ ...draft, artists })} onAdd={() => setPicker('artists')} />
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-[#e2d9ca] bg-[#fffaf2] p-2" data-acciones-carrusel>
              <button type="button" className={`${BTN_INK_MD} max480:flex-1`} disabled={!dirty || busy || total === 0} onClick={save} data-guardar>
                <Icon name="check" className="size-4" /> {busy ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" className={`${BTN_INK_OUTLINE_MD} max480:flex-1`} disabled={!dirty || busy} onClick={cancel} data-cancelar>Cancelar</button>
              <button type="button" className={`${BTN_GHOST} ml-auto min-h-11 max480:ml-0 max480:w-full`} disabled={busy} onClick={() => setConfirmReset(true)} data-automatico>
                Volver a automático
              </button>
              {dirty && <span className="w-full px-2 text-[13px] font-semibold text-[#6b500f]" data-cambios-pendientes>Cambios sin guardar</span>}
            </div>

            <PreviewStrip slides={saved.preview} dirty={dirty} />
          </motion.div>
        )}
        <p className="sr-only" aria-live="polite" data-anuncio-carrusel>{message}</p>
      </section>

      {picker && draft && (
        <CarouselPicker section={picker} restorable={restorable(picker)}
          excluded={new Set(draft[picker].map(itemKey))} onAdd={(item) => add(picker, item)} onClose={() => setPicker(null)} />
      )}
      {confirmReset && (
        <ConfirmDialog title="¿Volver a automático?" danger confirmLabel="Sí, volver a automático" onCancel={() => setConfirmReset(false)} onConfirm={reset}
          text="Se quitan todos los elegidos y las cantidades vuelven a 10 de contenido, 3 de Moneystack y 3 de TEJIDO." />
      )}
    </MotionConfig>
  );
}
