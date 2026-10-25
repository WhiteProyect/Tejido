import { useCallback, useEffect, useState } from 'react';
import EmptyNote from '../EmptyNote.jsx';
import Icon from '../Icon.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_SM, BTN_QUIET_SM, FORM_INPUT, PANEL, PANEL_TITLE } from '../uiStyles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { apiRequest } from '../../utils/api.js';
import { KIND_LABELS } from '../../utils/constants.js';
import { formatDateShort } from '../../utils/dateUtils.js';
import { STATUS_LABELS } from '../../utils/publicationStatus.js';

// Bandeja del admin (#admin-dashboard/bandeja), dos secciones con filtro Pendientes / Todos:
// - Mensajes de Nosotros: GET /api/admin/suggestions?status=NEW|ALL, PATCH .../{id} {status}.
//   El backend separa nombre y contacto de la cabecera que agrega el formulario.
// - Reportes de publicaciones: GET /api/admin/reports?status=OPEN|ALL, PATCH .../{id} {status, note}.
//   Atender un reporte no despublica: la publicacion se abre en la pestana Publicaciones.
// onChange avisa al dashboard para refrescar el Pulso y el contador de la pestana.
const LIMIT = 20;
const ERROR_BOX = 'mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';
const META = 'm-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted';
const PILL = 'rounded-full py-0.5 px-2 text-[12px] font-bold';

const MESSAGE_STATUS = {
  NEW: ['Nuevo', 'bg-[rgba(212,168,67,0.18)] text-[#7a5c12]'],
  READ: ['Leído', 'bg-[rgba(29,143,163,0.1)] text-[#146f80]'],
  ARCHIVED: ['Archivado', 'bg-[rgba(102,116,111,0.12)] text-[#4d5a55]'],
};
const REPORT_STATUS = {
  OPEN: ['Abierto', 'bg-[rgba(216,91,54,0.12)] text-[#a8431f]'],
  RESOLVED: ['Resuelto', 'bg-[rgba(29,143,163,0.1)] text-[#146f80]'],
  DISMISSED: ['Descartado', 'bg-[rgba(102,116,111,0.12)] text-[#4d5a55]'],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isPhone = (value) => /^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7;

// Lista paginada de una seccion: { loading, error, items, total, pending } + recargar / cargar mas.
function useInbox(url, pendingStatus) {
  const [filter, setFilter] = useState('pending'); // pending | all
  const [state, setState] = useState({ loading: true, error: '', items: [], total: 0, pending: null });

  const load = useCallback(async (count = LIMIT) => {
    const status = filter === 'pending' ? pendingStatus : 'ALL';
    try {
      const data = await apiRequest(`${url}?status=${status}&limit=${Math.min(count, 50)}`);
      setState({ loading: false, error: '', items: data.items, total: data.total, pending: data.pending });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, [url, pendingStatus, filter]);

  useEffect(() => { setState((current) => ({ ...current, loading: true })); load(); }, [load]);

  async function loadMore() {
    const status = filter === 'pending' ? pendingStatus : 'ALL';
    const page = Math.floor(state.items.length / LIMIT) + 1;
    try {
      const data = await apiRequest(`${url}?status=${status}&limit=${LIMIT}&page=${page}`);
      setState((current) => {
        const seen = new Set(current.items.map((item) => item.id));
        return { ...current, items: [...current.items, ...data.items.filter((item) => !seen.has(item.id))], total: data.total, pending: data.pending };
      });
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
  }

  return { filter, setFilter, state, reload: () => load(Math.max(state.items.length, LIMIT)), loadMore };
}

function FilterToggle({ value, onChange, label }) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-cream p-1" role="group" aria-label={label}>
      {[['pending', 'Pendientes'], ['all', 'Todos']].map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          className={`cursor-pointer rounded-full border-0 py-1.5 px-3.5 text-[13px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${value === id ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ id, icon, title, pending, pendingLabel, filter, onFilter }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id={id} className={`${PANEL_TITLE} flex items-center gap-3`}>
          <Icon name={icon} className="size-6 text-river" /> {title}
          {pending > 0 && <span className="rounded-full bg-[#a8431f] py-0.5 px-2.5 text-[14px] font-bold tracking-normal text-white">{pending}<span className="sr-only"> {pendingLabel}</span></span>}
        </h2>
        <p className="mt-2 mb-0 text-[14px] text-muted">{pending ? `${pending} ${pendingLabel}.` : 'Todo atendido.'}</p>
      </div>
      <FilterToggle value={filter} onChange={onFilter} label={`Filtrar ${title.toLowerCase()}`} />
    </div>
  );
}

function SectionBody({ state, empty, children, onMore }) {
  if (state.loading) return <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>;
  return (
    <>
      {state.error && <p className={ERROR_BOX} role="alert">{state.error}</p>}
      {state.items.length ? (
        <>
          <ul className="mt-4 mb-0 grid list-none gap-1 p-0">{children}</ul>
          {state.items.length < state.total && (
            <div className="mt-4"><button type="button" className={BTN_GHOST} onClick={onMore}>Ver más ({state.total - state.items.length})</button></div>
          )}
        </>
      ) : !state.error && <div className="mt-6">{empty}</div>}
    </>
  );
}

function Contact({ value }) {
  const { showToast } = useToast();
  if (!value) return null;
  if (EMAIL.test(value)) return <span className="break-all">{value}</span>;
  if (isPhone(value)) {
    async function copy() {
      try {
        await navigator.clipboard.writeText(value);
        showToast({ tone: 'menta', title: 'Número copiado' });
      } catch {
        showToast({ tone: 'naranja', title: 'No se pudo copiar', text: 'Selecciona el número y cópialo a mano.' });
      }
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="select-all font-semibold text-ink">{value}</span>
        <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold text-river underline" onClick={copy} aria-label={`Copiar el número ${value}`}>Copiar</button>
      </span>
    );
  }
  return <span className="break-all">{value}</span>;
}

function MessageItem({ item, busy, onStatus }) {
  const [label, tone] = MESSAGE_STATUS[item.status] || [item.status, MESSAGE_STATUS.ARCHIVED[1]];
  const isNew = item.status === 'NEW';
  const email = item.contact && EMAIL.test(item.contact) ? item.contact : null;
  return (
    <li className={`border-b border-b-line py-5 last:border-b-0 ${isNew ? 'rounded-[16px] bg-[rgba(212,168,67,0.08)] px-4 max600:px-3' : ''}`}>
      <p className={META}>
        <strong className="text-[14px] text-ink">{item.name || 'Visitante sin nombre'}</strong>
        <Contact value={item.contact} />
        <span aria-hidden="true">·</span>
        <span>{formatDateShort(item.created_at)}</span>
        <span className={`${PILL} ${tone}`}>{label}</span>
      </p>
      <p className="mt-2 mb-0 whitespace-pre-line text-[15px] leading-[1.55] text-[#44564f] [overflow-wrap:anywhere]">{item.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {email && <a className={BTN_INK_SM} href={`mailto:${email}?subject=${encodeURIComponent('Tu mensaje a TEJIDO')}`}><Icon name="send" className="size-3.5" /> Responder</a>}
        {isNew && <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onStatus(item, 'READ')}><Icon name="check" className="size-3.5" /> Marcar como leído</button>}
        {item.status !== 'ARCHIVED' && <button type="button" className={BTN_QUIET_SM} disabled={busy} onClick={() => onStatus(item, 'ARCHIVED')}>Archivar</button>}
      </div>
    </li>
  );
}

function ReportItem({ item, busy, onStatus }) {
  const [mode, setMode] = useState(null); // null | 'RESOLVED' | 'DISMISSED'
  const [note, setNote] = useState('');
  const [label, tone] = REPORT_STATUS[item.status] || [item.status, REPORT_STATUS.DISMISSED[1]];
  const { publication } = item;
  const [pubLabel, pubTone] = STATUS_LABELS[publication.status] || [publication.status, STATUS_LABELS.DRAFT[1]];
  const open = item.status === 'OPEN';

  return (
    <li className={`border-b border-b-line py-5 last:border-b-0 ${open ? 'rounded-[16px] bg-[rgba(216,91,54,0.05)] px-4 max600:px-3' : ''}`}>
      <p className={META}>
        <span>Reportado por <strong className="text-ink">{item.reporter_name || 'Usuario eliminado'}</strong></span>
        <span aria-hidden="true">·</span>
        <span>{formatDateShort(item.created_at)}</span>
        <span className={`${PILL} ${tone}`}>{label}</span>
      </p>
      <p className="mt-2 mb-0 text-[15px] leading-[1.55] text-[#44564f] [overflow-wrap:anywhere]"><strong className="text-ink">Motivo:</strong> {item.reason}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border border-line bg-white py-3 px-4">
        <span className="text-[12px] font-bold uppercase tracking-[.08em] text-muted">{KIND_LABELS[publication.kind] || publication.kind || 'Publicación'}</span>
        <span className="min-w-0 flex-1 basis-[200px] text-[15px] font-bold text-ink [overflow-wrap:anywhere]">{publication.title || `Publicación #${publication.id}`}</span>
        {publication.deleted ? (
          <span className={`${PILL} bg-[rgba(102,116,111,0.12)] text-[#4d5a55]`}>Eliminada</span>
        ) : (
          <>
            <span className={`${PILL} ${pubTone}`}>{pubLabel}</span>
            <a className="inline-flex items-center gap-1 text-[13px] font-bold text-river no-underline hover:underline" href={`#admin-dashboard/publicaciones/${publication.id}`}>
              Abrir en Publicaciones <Icon name="arrow-right" className="size-3.5" />
            </a>
          </>
        )}
      </div>
      {!open && item.resolution_note && <p className="mt-2 mb-0 text-[14px] text-[#53645c]"><strong>Nota:</strong> {item.resolution_note}</p>}
      {open && !mode && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => { setMode('RESOLVED'); setNote(''); }}><Icon name="check" className="size-3.5" /> Resuelto</button>
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => { setMode('DISMISSED'); setNote(''); }}>Descartar</button>
        </div>
      )}
      {open && mode && (
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); onStatus(item, mode, note.trim()); }}>
          <label className="grid min-w-[220px] flex-1 gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted">
            Nota (opcional)
            <input className={FORM_INPUT} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder={mode === 'RESOLVED' ? 'Qué se hizo' : 'Por qué se descarta'} disabled={busy} autoFocus />
          </label>
          <button type="submit" className={mode === 'RESOLVED' ? BTN_INK_SM : BTN_DANGER} disabled={busy}>{mode === 'RESOLVED' ? 'Marcar como resuelto' : 'Descartar reporte'}</button>
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
        </form>
      )}
    </li>
  );
}

const TOASTS = {
  READ: { eyebrow: 'Hilo leído', title: 'Mensaje marcado como leído' },
  ARCHIVED: { eyebrow: 'Hilo guardado', title: 'Mensaje archivado' },
  RESOLVED: { eyebrow: 'Hilo atendido', title: 'Reporte resuelto' },
  DISMISSED: { eyebrow: 'Hilo atendido', title: 'Reporte descartado' },
};

export default function BandejaPanel({ onChange }) {
  const { showToast } = useToast();
  const messages = useInbox('/api/admin/suggestions', 'NEW');
  const reports = useInbox('/api/admin/reports', 'OPEN');
  const [busy, setBusy] = useState(null); // 'm<id>' | 'r<id>'
  const [errors, setErrors] = useState({ messages: '', reports: '' });

  async function act(section, item, status, note) {
    const isReport = section === 'reports';
    setBusy(`${isReport ? 'r' : 'm'}${item.id}`);
    setErrors((current) => ({ ...current, [section]: '' }));
    try {
      await apiRequest(`/api/admin/${isReport ? 'reports' : 'suggestions'}/${item.id}`, {
        method: 'PATCH', body: isReport ? { status, note } : { status },
      });
      showToast({ tone: 'menta', ...TOASTS[status] });
      await (isReport ? reports : messages).reload();
      onChange?.();
    } catch (error) {
      setErrors((current) => ({ ...current, [section]: error.message }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className={PANEL} aria-labelledby="bandeja-mensajes">
        <SectionHeader
          id="bandeja-mensajes" icon="inbox" title="Mensajes" pendingLabel="sin leer"
          pending={messages.state.pending} filter={messages.filter} onFilter={messages.setFilter}
        />
        {errors.messages && <p className={ERROR_BOX} role="alert">{errors.messages}</p>}
        <SectionBody
          state={messages.state}
          onMore={messages.loadMore}
          empty={messages.filter === 'pending'
            ? <EmptyNote icon="inbox" title="Sin mensajes nuevos" text="Lo que la gente escriba desde Nosotros llegará aquí." />
            : <EmptyNote icon="inbox" title="Aún no hay mensajes" text="Cuando alguien escriba desde Nosotros, su mensaje aparecerá aquí." />}
        >
          {messages.state.items.map((item) => (
            <MessageItem key={item.id} item={item} busy={busy === `m${item.id}`} onStatus={(target, status) => act('messages', target, status)} />
          ))}
        </SectionBody>
      </section>

      <section className={PANEL} aria-labelledby="bandeja-reportes">
        <SectionHeader
          id="bandeja-reportes" icon="seal" title="Reportes" pendingLabel={reports.state.pending === 1 ? 'abierto' : 'abiertos'}
          pending={reports.state.pending} filter={reports.filter} onFilter={reports.setFilter}
        />
        {errors.reports && <p className={ERROR_BOX} role="alert">{errors.reports}</p>}
        <SectionBody
          state={reports.state}
          onMore={reports.loadMore}
          empty={reports.filter === 'pending'
            ? <EmptyNote icon="seal" title="Ningún reporte abierto" text="Cuando alguien reporte una publicación, aparecerá aquí para revisarla." />
            : <EmptyNote icon="seal" title="Aún no hay reportes" text="Los reportes de publicaciones que haga la comunidad aparecerán aquí." />}
        >
          {reports.state.items.map((item) => (
            <ReportItem key={item.id} item={item} busy={busy === `r${item.id}`} onStatus={(target, status, note) => act('reports', target, status, note)} />
          ))}
        </SectionBody>
      </section>
    </>
  );
}
