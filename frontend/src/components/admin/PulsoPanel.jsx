import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, Reorder, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { DragHandle, MoveButtons, moveFocus, moveItem } from './SortableControls.jsx';
import Icon from '../Icon.jsx';
import { BTN_GHOST, BTN_INK_MD, BTN_INK_OUTLINE_MD, PANEL, PANEL_TITLE } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';
import { PULSO_CARDS, PULSO_CATALOG, PULSO_DEFAULT, PULSO_EDIT_EVENT, PULSO_MAX } from '../../utils/pulsoCatalog.js';
import { useUnsavedChanges } from './artist/unsavedChanges.js';

// Pulso del dashboard del admin, personalizable por admin (GET/PUT/DELETE /api/admin/preferences/pulso;
// el catalogo y los conteos vienen del backend). Vista: tarjetas en grilla (4 columnas con >= 600 px utiles,
// si no 2), entrada escalonada y conteo ascendente solo en el primer montaje. Modo edicion (lapiz del
// header, evento PULSO_EDIT_EVENT): todas las tarjetas del catalogo, las visibles arriba y en orden
// (arrastre con el asa, o Subir/Bajar con el teclado y un aviso aria-live) y las ocultas en "Disponibles".
// Entre 1 y 12 visibles. Guardar / Cancelar / Restablecer; Esc cancela; con cambios sin guardar se pregunta
// antes de salir (mismo patron que los editores: useUnsavedChanges + confirmDiscard). Mientras se edita no
// hay enlaces ni conteo. Animaciones con layout y AnimatePresence; MotionConfig reducedMotion="user" las
// apaga con movimiento reducido.
const PREFS_URL = '/api/admin/preferences/pulso';
const CARD = 'relative flex h-full min-h-[132px] flex-col justify-between gap-3 rounded-[16px] border border-[#ddd5c7] bg-[#fffdf6] p-5 [box-shadow:0_1px_2px_rgba(23,63,54,.06),0_2px_6px_rgba(23,63,54,.05)] max600:min-h-[120px] max600:p-4';
const easeOut = (t) => 1 - (1 - t) ** 3;
const DISCARD = 'Tienes cambios sin guardar en el Pulso. ¿Descartarlos?';
const same = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

function Value({ value, shown }) {
  if (value == null) return '–';
  return <><span aria-hidden="true">{shown}</span><span className="sr-only">{value}</span></>;
}

function Switch({ on, label, disabled, reasonId, onToggle }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} aria-disabled={disabled || undefined} aria-describedby={disabled ? reasonId : undefined}
      onClick={() => { if (!disabled) onToggle(); }} data-interruptor
      className={`inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <span className={`relative inline-flex h-6 w-10 items-center rounded-full border-2 transition-colors duration-200 motion-reduce:transition-none ${on ? 'border-ink bg-ink' : 'border-[#4d5a55] bg-[#f3e4c8]'}`}>
        <span className={`absolute size-4 rounded-full bg-white transition-[left] duration-200 motion-reduce:transition-none ${on ? 'left-[18px]' : 'left-[2px]'}`} />
      </span>
    </button>
  );
}

// Fila arrastrable del modo edicion (cada una con su propio control de arrastre: solo el asa arrastra).
function EditRow({ id, index, total, stats, atMin, minReasonId, onToggle, onMove, onDragEnd }) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  const card = PULSO_CARDS[id];
  const { value, detail } = card.read(stats);
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} layoutId={`pulso-${id}`}
      className="flex min-w-0 items-center gap-1.5 rounded-[16px] border border-[#ddd5c7] bg-[#fffdf6] py-1.5 pr-1.5 pl-1 [box-shadow:0_1px_2px_rgba(23,63,54,.06)]"
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }} transition={{ duration: reduce ? 0 : 0.2 }} data-pulso-visible={id}>
      <DragHandle controls={controls} label={card.label} />
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="text-[14px] font-bold text-ink [overflow-wrap:anywhere]">{card.label}</span>
        <span className="text-[13px] text-[#53645c]">{value ?? '–'}{detail ? ` · ${detail}` : ''}</span>
      </span>
      <Switch on label={`Mostrar «${card.label}» en el Pulso`} disabled={atMin} reasonId={minReasonId} onToggle={() => onToggle(id)} />
      <MoveButtons label={card.label} index={index} total={total} onMove={(delta) => onMove(id, delta)} />
    </Reorder.Item>
  );
}

export default function PulsoPanel({ stats, cornerSpace = false }) {
  const { showToast } = useToast();
  const reduce = useReducedMotion();
  const panelRef = useRef(null);
  const [prefs, setPrefs] = useState({ status: 'loading', pulso: null, failed: false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announce, setAnnounce] = useState('');
  const pendingEdit = useRef(false);

  // Conteo ascendente solo en el primer montaje con datos; los refrescos ponen el valor directo.
  // Con movimiento reducido el valor final va directo desde el primer cuadro.
  const [progress, setProgress] = useState(() => (stats || reduce ? 1 : 0));
  const started = useRef(Boolean(stats));
  const frame = useRef(0);
  const firstMount = useRef(true);
  useEffect(() => { firstMount.current = false; }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    if (!stats || started.current) return;
    started.current = true;
    if (reduce) { setProgress(1); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 700));
      setProgress(easeOut(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [stats, reduce]);

  // Preferencias (a la par de las stats). Si falla: el default y una nota discreta.
  useEffect(() => {
    let alive = true;
    apiRequest(PREFS_URL)
      .then((data) => {
        if (!alive) return;
        // Ids que este frontend no conoce se descartan; si no queda ninguno, el default (igual que el backend).
        const known = (Array.isArray(data?.pulso) ? data.pulso : []).filter((id) => PULSO_CARDS[id]);
        setPrefs({ status: 'ready', pulso: known.length ? known : [...PULSO_DEFAULT], failed: false });
      })
      .catch(() => alive && setPrefs({ status: 'ready', pulso: [...PULSO_DEFAULT], failed: true }));
    return () => { alive = false; };
  }, []);

  const saved = prefs.pulso || PULSO_DEFAULT;
  const dirty = editing && !same(draft, saved);
  useUnsavedChanges(dirty);

  function startEditing() {
    if (prefs.status !== 'ready') { pendingEdit.current = true; return; }
    setDraft([...saved]);
    setConfirmReset(false);
    setEditing(true);
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      panelRef.current?.querySelector('[data-pulso-edicion] button')?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    const onRequest = () => startEditing();
    window.addEventListener(PULSO_EDIT_EVENT, onRequest);
    return () => window.removeEventListener(PULSO_EDIT_EVENT, onRequest);
  });
  useEffect(() => {
    if (prefs.status === 'ready' && pendingEdit.current) { pendingEdit.current = false; startEditing(); }
  }, [prefs.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeEditing(force = false) {
    if (!force && dirty && !window.confirm(DISCARD)) return false;
    setEditing(false);
    setConfirmReset(false);
    setAnnounce('');
    return true;
  }

  useEffect(() => {
    if (!editing) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role=dialog], [role=alertdialog]')) return;
      event.preventDefault();
      closeEditing();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const hidden = PULSO_CATALOG.filter((id) => !draft.includes(id));
  const atMin = draft.length <= 1;
  const atMax = draft.length >= PULSO_MAX;

  function toggle(id) {
    if (draft.includes(id)) {
      if (atMin) return;
      setDraft(draft.filter((item) => item !== id));
      setAnnounce(`${PULSO_CARDS[id].label} oculta. ${draft.length - 1} de ${PULSO_MAX} visibles.`);
    } else {
      if (atMax) return;
      setDraft([...draft, id]);
      setAnnounce(`${PULSO_CARDS[id].label} visible en la posición ${draft.length + 1}.`);
    }
  }

  function move(id, delta) {
    const next = moveItem(draft, draft.indexOf(id), delta);
    if (!next) return;
    setDraft(next);
    setAnnounce(`${PULSO_CARDS[id].label} movida a la posición ${next.indexOf(id) + 1}.`);
    // El foco sigue al boton que se uso (o al otro si llego al extremo).
    moveFocus(() => panelRef.current?.querySelector(`[data-pulso-visible="${id}"]`), delta);
  }

  function dragEnded(id) {
    setAnnounce(`${PULSO_CARDS[id].label} movida a la posición ${draft.indexOf(id) + 1}.`);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const data = await apiRequest(PREFS_URL, { method: 'PUT', body: { pulso: draft } });
      setPrefs({ status: 'ready', pulso: data.pulso, failed: false });
      setEditing(false);
      showToast({ tone: 'menta', title: 'Pulso guardado', text: 'Así lo verás desde cualquier dispositivo.' });
    } catch (error) {
      showToast({ tone: 'naranja', title: 'No pudimos guardar el Pulso', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (saving) return;
    setSaving(true);
    try {
      const data = await apiRequest(PREFS_URL, { method: 'DELETE' });
      setPrefs({ status: 'ready', pulso: data.pulso, failed: false });
      setEditing(false);
      setConfirmReset(false);
      showToast({ tone: 'menta', title: 'Pulso restablecido', text: 'Volviste a las 8 tarjetas de siempre.' });
    } catch (error) {
      showToast({ tone: 'naranja', title: 'No pudimos restablecer el Pulso', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  const loading = !stats || prefs.status !== 'ready';
  const animateIn = firstMount.current && !reduce;
  const reasonMin = 'pulso-min';
  const reasonMax = 'pulso-max';

  return (
    <MotionConfig reducedMotion="user" transition={reduce ? { duration: 0 } : undefined}>
      <section ref={panelRef} className={`${PANEL} scroll-mt-28`} aria-labelledby="admin-pulso" data-pulso-panel={editing ? 'edicion' : 'vista'}>
        <div className={`flex flex-wrap items-start justify-between gap-3 ${cornerSpace ? 'pr-12' : ''}`}>
          <h2 id="admin-pulso" className={PANEL_TITLE}>Pulso de la plataforma</h2>
          {editing && (
            <p className="m-0 rounded-full bg-[#f3e4c8] px-3 py-1.5 text-[14px] font-bold text-ink" aria-live="polite" data-contador-pulso>
              {draft.length} de {PULSO_MAX} visibles
            </p>
          )}
        </div>
        {prefs.failed && !editing && (
          <p className="mt-2 mb-0 text-[13px] text-[#53645c]" data-nota-pulso>No pudimos cargar tu Pulso personalizado: mostramos el de siempre.</p>
        )}
        <p className="sr-only" aria-live="polite" data-anuncio-pulso>{announce}</p>

        {loading ? (
          <div className="@container mt-6" aria-hidden="true" data-esqueleto-pulso>
            <div className="grid auto-rows-fr grid-cols-[repeat(2,minmax(0,1fr))] gap-3 @min-[600px]:grid-cols-[repeat(4,minmax(0,1fr))] @min-[600px]:gap-4">
              {/* La misma tarjeta (etiqueta y "–") para que la grilla no salte al llegar los datos. */}
              {PULSO_DEFAULT.map((id) => (
                <div key={id} className={`${CARD} motion-safe:animate-pulse`}>
                  <span className="text-[12px] font-bold uppercase leading-[1.3] tracking-[.1em] text-[#53645c]">
                    {PULSO_CARDS[id].label}
                    {id === 'revision_talento_artistas' && <span className="mt-1 block text-[12px] font-semibold normal-case tracking-normal">&nbsp;</span>}
                  </span>
                  <span className="order-first font-sans text-[40px] font-extrabold leading-none text-[#cfc6b6] max600:text-[34px]">–</span>
                </div>
              ))}
            </div>
          </div>
        ) : editing ? (
          <LayoutGroup id="pulso">
            <div className="mt-5 grid gap-5" data-pulso-edicion>
              <div className="grid gap-1 text-[14px] text-[#53645c]">
                <p className="m-0">Elige qué ves y en qué orden: arrastra desde el asa o usa Subir y Bajar. Entre 1 y {PULSO_MAX} tarjetas.</p>
                {atMin && <p id={reasonMin} className="m-0 font-bold text-[#6b500f]">Deja al menos una tarjeta visible.</p>}
                {atMax && <p id={reasonMax} className="m-0 font-bold text-[#6b500f]">Llegaste a {PULSO_MAX} visibles: oculta una para mostrar otra.</p>}
              </div>
              <section aria-labelledby="pulso-visibles">
                <h3 id="pulso-visibles" className="m-0 mb-2 text-[13px] font-bold uppercase tracking-[.1em] text-[#53645c]">Visibles</h3>
                <Reorder.Group axis="y" values={draft} onReorder={setDraft} className="m-0 grid list-none gap-2 p-0" data-lista-visibles>
                  <AnimatePresence initial={false}>
                    {draft.map((id, index) => (
                      <EditRow key={id} id={id} index={index} total={draft.length} stats={stats} atMin={atMin} minReasonId={reasonMin}
                        onToggle={toggle} onMove={move} onDragEnd={() => dragEnded(id)} />
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              </section>
              {hidden.length > 0 && (
                <section aria-labelledby="pulso-disponibles">
                  <h3 id="pulso-disponibles" className="m-0 mb-2 text-[13px] font-bold uppercase tracking-[.1em] text-[#53645c]">Disponibles</h3>
                  <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 p-0" data-lista-disponibles>
                    <AnimatePresence initial={false}>
                      {hidden.map((id) => (
                        <motion.li key={id} layoutId={`pulso-${id}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }} transition={{ duration: reduce ? 0 : 0.2 }}
                          className="flex min-w-0 items-center gap-2 rounded-[16px] border border-dashed border-[#d9cfbe] bg-[#f7f2e8] py-1.5 pr-1.5 pl-3 text-[#4d5a55]" data-pulso-oculta={id}>
                          <Icon name={PULSO_CARDS[id].icon} className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 text-[14px] font-semibold [overflow-wrap:anywhere]">{PULSO_CARDS[id].label}</span>
                          <Switch on={false} label={`Mostrar «${PULSO_CARDS[id].label}» en el Pulso`} disabled={atMax} reasonId={reasonMax} onToggle={() => toggle(id)} />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-[#ddd5c7] pt-4" data-acciones-pulso>
                <button type="button" className={BTN_INK_MD} onClick={save} disabled={saving} data-guardar-pulso>{saving ? 'Guardando…' : 'Guardar'}</button>
                <button type="button" className={BTN_INK_OUTLINE_MD} onClick={() => closeEditing()} disabled={saving} data-cancelar-pulso>Cancelar</button>
                {confirmReset ? (
                  <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar restablecer">
                    <span className="text-[14px] font-semibold text-ink">¿Volver a las 8 tarjetas de siempre?</span>
                    <button type="button" className={BTN_GHOST} onClick={reset} disabled={saving} data-confirmar-restablecer>Sí, restablecer</button>
                    <button type="button" className={BTN_GHOST} onClick={() => setConfirmReset(false)} disabled={saving}>No</button>
                  </span>
                ) : (
                  <button type="button" className={BTN_GHOST} onClick={() => setConfirmReset(true)} disabled={saving} data-restablecer-pulso>Restablecer</button>
                )}
              </div>
            </div>
          </LayoutGroup>
        ) : (
          <LayoutGroup id="pulso">
            {/* 4 columnas (4x2) cuando el panel tiene >= 600 px utiles; si no, 2. */}
            <div className="@container mt-6">
              <dl className="m-0 grid auto-rows-fr grid-cols-[repeat(2,minmax(0,1fr))] gap-3 @min-[600px]:grid-cols-[repeat(4,minmax(0,1fr))] @min-[600px]:gap-4" data-pulso>
                <AnimatePresence initial={false}>
                  {saved.map((id, index) => {
                    const card = PULSO_CARDS[id];
                    const { value, detail, href: dynamicHref, linkLabel } = card.read(stats);
                    const href = dynamicHref || card.href;
                    const shown = value == null ? null : Math.round(value * progress);
                    return (
                      <motion.div key={id} layoutId={`pulso-${id}`}
                        className={`${CARD} ${href ? 'transition-[border-color] duration-200 hover:border-ink has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ink' : ''}`}
                        initial={animateIn ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.25, ease: 'easeOut', delay: animateIn ? index * 0.04 : 0 }}
                        whileHover={href && !reduce ? { y: -2, transition: { duration: 0.15 } } : undefined}
                        data-tarjeta-pulso={id === 'revision_talento_artistas' ? 'revision' : card.label} data-pulso-id={id}>
                        <dt className="order-2 text-[12px] font-bold uppercase leading-[1.3] tracking-[.1em] text-[#53645c]">
                          {href ? (
                            <a className="inline-flex items-start gap-1 text-ink no-underline outline-none after:absolute after:inset-0 after:rounded-[16px] hover:underline" href={href} aria-label={linkLabel} data-enlace-pulso>
                              <span>{card.label}</span> <Icon name="arrow-right" className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                            </a>
                          ) : card.label}
                          {detail && <span className="mt-1 block text-[12px] font-semibold normal-case tracking-normal text-[#53645c]" data-detalle>{detail}</span>}
                        </dt>
                        <dd className="order-1 m-0 font-sans text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink max600:text-[34px]" data-valor={value ?? ''}>
                          <Value value={value} shown={shown} />
                        </dd>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </dl>
            </div>
          </LayoutGroup>
        )}
      </section>
    </MotionConfig>
  );
}
