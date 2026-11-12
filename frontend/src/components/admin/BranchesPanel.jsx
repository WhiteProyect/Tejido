import { useCallback, useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';
import ImageField from '../ImageField.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, BTN_INK_SM, FORM_INPUT, FORM_LABEL, PANEL, PANEL_TITLE } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { hasStaticCover, setAdminBranches } from '../../utils/culturalBranches.js';

// Ramas de cultura (#admin-dashboard/ramas): GET/POST/PATCH/DELETE /api/admin/cultural-branches y
// .../{clave}/move. Cada tarjeta: portada, nombre, estado, conteos y lider; editar nombre e imagen (la
// clave y el slug no cambian), subir/bajar, desactivar/activar y eliminar. Los botones que no aplican
// quedan deshabilitados con su razon a la vista (la que da la API). Tras cada cambio, setAdminBranches
// actualiza Explorar, filtros y formularios sin recargar. El publico las sigue llamando "categorias".
const API = '/api/admin/cultural-branches';
const LABEL_MAX = 60;
const ORDER_BTN = 'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-[#d9cfbe] bg-white text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const CHIP = 'whitespace-nowrap rounded-full py-0.5 px-2.5 text-[11px] font-bold uppercase tracking-[.08em]';
const ALERT = 'm-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[15px] text-[#b3442b]';
const EASE = [0.22, 1, 0.36, 1];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function countsText(counts) {
  const parts = [
    plural(counts.gestores, 'gestor', 'gestores'),
    plural(counts.publicaciones, 'publicación', 'publicaciones'),
    plural(counts.talento, 'talento', 'talentos'),
  ];
  if (counts.solicitudes_pendientes) parts.push(plural(counts.solicitudes_pendientes, 'solicitud pendiente', 'solicitudes pendientes'));
  return parts.join(' · ');
}

// Portada: la propia (Cloudinary), si no la estatica de las 10 iniciales, y si no, la inicial sobre crema.
function Cover({ branch }) {
  const sources = [
    ...(branch.image_url ? [cdnImage(branch.image_url, { width: 640 })] : []),
    ...(hasStaticCover(branch.key) ? [`/images/categorias/${branch.slug}.jpg`] : []),
  ];
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setAttempt(0); }, [branch.image_url]);
  const src = sources[attempt];
  return (
    <div className={`relative aspect-[16/9] overflow-hidden rounded-[16px] bg-[#efe6d6] ${branch.active ? '' : 'grayscale'}`}>
      {src ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setAttempt((current) => current + 1)} data-portada-rama />
      ) : (
        <span className="grid size-full place-items-center font-sans text-[44px] font-extrabold text-[#8a7a5c]" aria-hidden="true">{branch.label.charAt(0)}</span>
      )}
    </div>
  );
}

function EditForm({ branch, busy, onSave, onCancel }) {
  const id = useId();
  const [label, setLabel] = useState(branch.label);
  const [image, setImage] = useState(branch.image_url || '');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (label.trim().length < 2) { setError('Escribe el nombre (al menos 2 caracteres).'); return; }
    const message = await onSave(branch, { label: label.trim(), image_url: image || null });
    if (message) setError(message);
  }
  return (
    <form className="grid gap-4" onSubmit={submit} noValidate aria-label={`Editar ${branch.label}`}>
      <div className="grid gap-1.5">
        <label className={FORM_LABEL} htmlFor={`${id}-nombre`}>Nombre</label>
        <input id={`${id}-nombre`} className={FORM_INPUT} value={label} maxLength={LABEL_MAX} autoFocus disabled={busy}
          onChange={(event) => { setLabel(event.target.value); setError(''); }} aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined} />
      </div>
      <ImageField label="Portada" value={image} onChange={setImage} scope="category_cover" disabled={busy}
        hint="JPG, PNG o WebP de hasta 10 MB. Mejor horizontal: se recorta en las tarjetas de Explorar." />
      {error && <p id={`${id}-error`} className="m-0 text-[14px] font-semibold text-[#b3442b]" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_INK_SM} disabled={busy}><Icon name="check" className="size-3.5" /> Guardar</button>
        <button type="button" className={BTN_GHOST} disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function BranchCard({ branch, index, total, busy, onAction, onSave }) {
  const [mode, setMode] = useState(null); // null | 'edit' | 'deactivate' | 'delete'
  const reasonId = useId();
  const reasons = [
    branch.protected ? 'Rama base: no se puede desactivar ni borrar.' : null,
    !branch.protected && branch.active && !branch.can_deactivate ? branch.deactivate_reason : null,
    !branch.protected && !branch.can_delete ? branch.delete_reason : null,
  ].filter(Boolean);
  const canToggle = branch.active ? branch.can_deactivate : true;

  return (
    <article className="grid h-full content-start gap-4 rounded-[22px] border border-[#e2d9ca] bg-white p-4" data-rama={branch.key} aria-busy={busy}>
      <Cover branch={branch} />
      {mode === 'edit' ? (
        <EditForm branch={branch} busy={busy} onCancel={() => setMode(null)}
          onSave={async (item, values) => { const message = await onSave(item, values); if (!message) setMode(null); return message; }} />
      ) : (
        <>
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 min-w-0 font-sans text-[19px] font-bold leading-[1.2] tracking-[-0.02em] text-ink">{branch.label}</h3>
              <span className={`${CHIP} ${branch.active ? 'bg-[#dcefe5] text-[#245a43]' : 'bg-[#ece7df] text-[#3f4a46]'}`}>{branch.active ? 'Activa' : 'Desactivada'}</span>
              {branch.protected && <span className={`${CHIP} bg-[#f6ebcc] text-[#6b500f]`}>Rama base</span>}
            </div>
            <p className="m-0 text-[14px] text-[#53645c]">{countsText(branch.counts)}</p>
            <p className="m-0 text-[14px] text-[#53645c]">{branch.leader ? <>Líder: <strong className="text-ink">{branch.leader}</strong></> : 'Sin líder'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={ORDER_BTN} disabled={busy || index === 0} aria-label={`Subir ${branch.label}`} data-mover="up"
              onClick={() => onAction(branch, 'up')}><Icon name="arrow-up" className="size-4" /></button>
            <button type="button" className={ORDER_BTN} disabled={busy || index === total - 1} aria-label={`Bajar ${branch.label}`} data-mover="down"
              onClick={() => onAction(branch, 'down')}><Icon name="arrow-down" className="size-4" /></button>
            <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode('edit')} aria-label={`Editar ${branch.label}`}>
              <Icon name="pen" className="size-3.5" /> Editar
            </button>
            <button type="button" className={BTN_GHOST} disabled={busy || !canToggle} data-accion={branch.active ? 'desactivar' : 'activar'}
              aria-describedby={reasons.length ? reasonId : undefined}
              onClick={() => (branch.active ? setMode('deactivate') : onAction(branch, 'activate'))}>
              {branch.active ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" className={BTN_DANGER} disabled={busy || !branch.can_delete} data-accion="eliminar"
              aria-describedby={reasons.length ? reasonId : undefined} onClick={() => setMode('delete')}>
              Eliminar
            </button>
          </div>
          {reasons.length > 0 && (
            <p id={reasonId} className="m-0 text-[13px] leading-[1.45] text-[#6b500f]" data-razon>{reasons.map((text) => (/[.!?]$/.test(text) ? text : `${text}.`)).join(' ')}</p>
          )}

          {mode === 'deactivate' && (
            <div className="grid gap-2 rounded-[14px] bg-[#f6efe2] p-3" role="group" aria-label={`Confirmar desactivar ${branch.label}`}>
              <p className="m-0 text-[14px] leading-[1.45] text-[#3f514a]">Deja de verse en Explorar, filtros y formularios. Lo que ya existe se conserva y sus gestores no crean contenido nuevo.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BTN_DANGER} disabled={busy} autoFocus onClick={() => { setMode(null); onAction(branch, 'deactivate'); }}>Sí, desactivar</button>
                <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>No</button>
              </div>
            </div>
          )}
          {mode === 'delete' && (
            <div className="grid gap-2 rounded-[14px] bg-[#fbe9e1] p-3" role="group" aria-label={`Confirmar eliminar ${branch.label}`}>
              <p className="m-0 text-[14px] leading-[1.45] text-[#7a321a]">Se borra para siempre. No tiene contenido ni gestores.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BTN_DANGER} disabled={busy} autoFocus onClick={() => { setMode(null); onAction(branch, 'delete'); }}>Sí, eliminar</button>
                <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>No</button>
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function CreateForm({ busy, onCreate, onClose }) {
  const id = useId();
  const [label, setLabel] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (label.trim().length < 2) { setError('Escribe el nombre de la rama (al menos 2 caracteres).'); return; }
    const message = await onCreate({ label: label.trim(), image_url: image || null });
    if (message) {
      setError(message);
      requestAnimationFrame(() => document.getElementById(`${id}-nombre`)?.focus());
    }
  }
  return (
    <form className="mt-5 grid gap-4 rounded-[20px] border border-line bg-white/60 p-5" onSubmit={submit} noValidate aria-label="Nueva rama" data-form-nueva-rama>
      <div className="grid gap-1.5">
        <label className={FORM_LABEL} htmlFor={`${id}-nombre`}>Nombre de la rama</label>
        <input id={`${id}-nombre`} className={`${FORM_INPUT} max-w-[420px] ${error ? 'border-[#b3442b]' : ''}`} value={label} maxLength={LABEL_MAX}
          placeholder="P. ej. Fotografía" autoFocus disabled={busy} onChange={(event) => { setLabel(event.target.value); setError(''); }}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : `${id}-ayuda`} />
        <span id={`${id}-ayuda`} className="text-[13px] text-[#53645c]">Se agrega al final de la lista. El nombre se puede cambiar después; su dirección (#categoria/…) no.</span>
      </div>
      <ImageField label="Portada (opcional)" value={image} onChange={setImage} scope="category_cover" disabled={busy}
        hint="JPG, PNG o WebP de hasta 10 MB. Sin portada se ve la inicial sobre un fondo liso." />
      {error && <p id={`${id}-error`} className="m-0 text-[14px] font-semibold text-[#b3442b]" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_INK_MD} disabled={busy || !label.trim()}><Icon name="check" className="size-4" /> Crear rama</button>
        <button type="button" className={BTN_GHOST} disabled={busy} onClick={onClose}>Cancelar</button>
      </div>
    </form>
  );
}

export default function BranchesPanel() {
  const { showToast } = useToast();
  const reduce = useReducedMotion();
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const apply = useCallback((items) => {
    setState({ loading: false, items, error: '' });
    setAdminBranches(items);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await apiRequest(API));
    } catch (error) {
      setState({ loading: false, items: [], error: error.message });
    }
  }, [apply]);

  useEffect(() => { load(); }, [load]);

  // Ejecuta una accion, recarga la lista y avisa. Devuelve el mensaje de error (o '' si salio bien).
  async function run(action, toast) {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      if (Array.isArray(result)) apply(result);
      else await load();
      if (toast) showToast({ tone: 'menta', ...toast });
      return '';
    } catch (error) {
      return error.message;
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(branch, action) {
    const url = `${API}/${branch.key}`;
    let error = '';
    if (action === 'up' || action === 'down') {
      error = await run(() => apiRequest(`${url}/move`, { method: 'POST', body: { direction: action } }));
      // El foco sigue a la rama movida (su boton de la misma direccion, o el otro si llego al borde).
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-rama="${branch.key}"]`);
        (card?.querySelector(`[data-mover="${action}"]:not(:disabled)`) || card?.querySelector('[data-mover]:not(:disabled)'))?.focus();
      });
    } else if (action === 'deactivate' || action === 'activate') {
      error = await run(() => apiRequest(url, { method: 'PATCH', body: { active: action === 'activate' } }),
        action === 'activate'
          ? { title: `«${branch.label}» está activa`, text: 'Vuelve a verse en Explorar, filtros y formularios.' }
          : { title: `«${branch.label}» quedó desactivada`, text: 'Lo que ya existe se conserva.' });
    } else if (action === 'delete') {
      error = await run(() => apiRequest(url, { method: 'DELETE' }), { title: `«${branch.label}» eliminada` });
    }
    if (error) {
      setMessage(error);
      requestAnimationFrame(() => document.querySelector('[data-mensaje-ramas]')?.focus());
    }
  }

  const handleSave = (branch, values) => run(() => apiRequest(`${API}/${branch.key}`, { method: 'PATCH', body: values }),
    { title: 'Rama actualizada', text: `${values.label} ya se ve así en Explorar.` });

  async function handleCreate(values) {
    const error = await run(() => apiRequest(API, { method: 'POST', body: values }),
      { eyebrow: 'Rama nueva', title: `«${values.label}» ya está en Explorar`, text: 'También se ofrece en filtros y formularios.' });
    if (!error) setCreating(false);
    return error;
  }

  const motionProps = (key) => (reduce
    ? {}
    : {
      layout: 'position',
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, scale: 0.96 },
      transition: { duration: 0.28, ease: EASE, layout: { duration: 0.32, ease: EASE } },
      key,
    });

  return (
    <section className={PANEL} aria-labelledby="admin-ramas">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-[680px]">
          <h2 id="admin-ramas" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="palette" className="size-6 text-river" /> Ramas de cultura</h2>
          <p className="mt-2 mb-0 text-[15px] text-muted">
            Organizan gestores, publicaciones y talento. En Explorar el público las ve como categorías, en este orden. Una rama en uso no se borra: desactívala. Los líderes pueden cambiar la portada de la suya.
          </p>
        </div>
        {!creating && (
          <button type="button" className={BTN_INK_MD} onClick={() => setCreating(true)} disabled={state.loading || Boolean(state.error)}>
            <Icon name="plus" className="size-4" /> Nueva rama
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {creating && (
          <motion.div key="nueva" initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: reduce ? 0 : 0.28, ease: EASE }} className="overflow-hidden">
            <CreateForm busy={busy} onCreate={handleCreate} onClose={() => setCreating(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {message && <p tabIndex={-1} data-mensaje-ramas className={`${ALERT} mt-5`} role="alert">{message}</p>}
      {state.loading && <p className="m-0 py-6 text-[15px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && <p className={`${ALERT} mt-4`} role="alert">{state.error}</p>}
      {!state.loading && !state.error && (
        <div className="@container mt-6">
          <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 @min-[620px]:grid-cols-2 @min-[960px]:grid-cols-3" aria-label="Ramas de cultura, en orden" data-lista-ramas>
            <AnimatePresence initial={false}>
              {state.items.map((branch, index) => (
                <motion.li className="flex min-w-0 [&>*]:w-full" {...motionProps(branch.key)} key={branch.key}>
                  <BranchCard key={`${branch.key}-${branch.label}-${branch.image_url}`} branch={branch} index={index} total={state.items.length}
                    busy={busy} onAction={handleAction} onSave={handleSave} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </section>
  );
}
