import { useCallback, useEffect, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import PublicationForm from '../components/PublicationForm.jsx';
import GestoresPanel from '../components/admin/GestoresPanel.jsx';
import { BTN_DANGER, BTN_DARK, BTN_GHOST, EYEBROW, FORM_INPUT, H1, LINK_BTN_SOLID, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Dashboard del Admin (#admin-dashboard):
// - Pulso: GET /api/admin/stats (incluye gestores_activos).
// - Gestores: components/admin/GestoresPanel.jsx, tal cual vivia en el perfil.
// - Publicaciones de TODOS los autores: GET /api/publications?status=<X> por cada estado (sin
//   status el listado solo trae las publicadas). Acciones:
//   REVIEW: Aprobar / Rechazar (motivo de 5+ caracteres) -> PATCH .../status
//   cualquier estado: Editar (PublicationForm con allowPublish) / Eliminar (DELETE).
// - Nueva publicacion: PublicationForm con allowPublish (puede publicar directo).
const STATUSES = ['REVIEW', 'DRAFT', 'REJECTED', 'PUBLISHED'];
const CATEGORY_LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));
const MIN_NOTE = 5; // mismo minimo que PATCH /api/publications/{id}/status

const byPriority = (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
  || String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at));

function StatsPanel({ stats }) {
  const tiles = [
    ['Publicadas', stats?.published],
    ['En revisión', stats?.pending],
    ['Gestores activos', stats?.gestores_activos],
    ['Usuarios activos', stats?.users],
    ['Reportes abiertos', stats?.reports],
    ['Mensajes nuevos', stats?.suggestions],
  ];
  return (
    <section className={PANEL} aria-labelledby="admin-pulso">
      <h2 id="admin-pulso" className={PANEL_TITLE}>Pulso de la plataforma</h2>
      <dl className="mt-6 mb-0 grid grid-cols-[repeat(6,1fr)] gap-4 max1200:grid-cols-[repeat(3,1fr)] max600:grid-cols-[repeat(2,1fr)]">
        {tiles.map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse border-l-2 border-l-[rgba(29,143,163,0.35)] pl-4">
            <dt className="mt-2 text-[12px] font-bold uppercase tracking-[.1em] text-muted">{label}</dt>
            <dd className="m-0 text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink">{value ?? '–'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AdminPublicationItem({ publication, busy, onEdit, onAction }) {
  const [mode, setMode] = useState(null); // null | 'reject' | 'delete'
  const [note, setNote] = useState('');
  const [statusLabel, statusTone] = STATUS_LABELS[publication.status] || [publication.status, STATUS_LABELS.DRAFT[1]];
  const date = formatDateShort(publication.start_date || publication.created_at);
  const inReview = publication.status === 'REVIEW';

  return (
    <li className={`border-b border-b-line py-5 last:border-b-0 ${inReview ? 'rounded-[16px] bg-[rgba(212,168,67,0.08)] px-4 max600:px-3' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[320px]">
          <p className="m-0 mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold uppercase tracking-[.08em] text-muted">
            <span>{KIND_LABELS[publication.kind] || publication.kind}</span>
            <span aria-hidden="true">·</span>
            <span>{CATEGORY_LABELS[publication.cultural_category] || 'Sin categoría'}</span>
            {date && <><span aria-hidden="true">·</span><span className="font-semibold normal-case tracking-normal">{date}</span></>}
          </p>
          <h3 className="m-0 font-sans text-[19px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{publication.title}</h3>
          <p className="mt-1 mb-0 text-[14px] text-[#53645c]">Por <strong className="text-ink">{publication.author || 'Autor desconocido'}</strong></p>
          {publication.status === 'REJECTED' && publication.moderation_note && (
            <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Motivo:</strong> {publication.moderation_note}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max600:justify-start">
          <span className={`rounded-full py-1 px-3 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span>
          {inReview && (
            <>
              <button type="button" className={BTN_DARK} disabled={busy} onClick={() => onAction(publication, 'approve')}><Icon name="check" className="size-3.5" /> Aprobar</button>
              <button type="button" className={BTN_GHOST} disabled={busy} aria-expanded={mode === 'reject'} onClick={() => { setMode(mode === 'reject' ? null : 'reject'); setNote(''); }}>Rechazar</button>
            </>
          )}
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onEdit(publication)}><Icon name="pen" className="size-3.5" /> Editar</button>
          {mode === 'delete' ? (
            <>
              <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => onAction(publication, 'delete')}>Sí, eliminar</button>
              <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>No</button>
            </>
          ) : (
            <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setMode('delete')}>Eliminar</button>
          )}
        </div>
      </div>
      {mode === 'reject' && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => { event.preventDefault(); onAction(publication, 'reject', note.trim()); }}
        >
          <label className="grid min-w-[240px] flex-1 gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted">
            Motivo para el gestor
            <input className={FORM_INPUT} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Qué debe ajustar para publicarla" disabled={busy} autoFocus />
          </label>
          <button type="submit" className={BTN_DANGER} disabled={busy || note.trim().length < MIN_NOTE}>Rechazar con este motivo</button>
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
        </form>
      )}
    </li>
  );
}

export default function AdminDashboard() {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [state, setState] = useState({ loading: true, error: '', publications: [], categories: [] });
  const [editor, setEditor] = useState(null); // null | { publication: null | objeto }
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const [statsData, categories, ...lists] = await Promise.all([
        apiRequest('/api/admin/stats'),
        apiRequest('/api/categories'),
        ...STATUSES.map((status) => apiRequest(`/api/publications?status=${status}`)),
      ]);
      setStats(statsData);
      setState({ loading: false, error: '', publications: lists.flat().sort(byPriority), categories });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEditor(publication = null) {
    setActionError('');
    setEditor({ publication });
    // El formulario aparece sobre la lista: se lleva la vista hasta el (tras pintarlo).
    requestAnimationFrame(() => document.getElementById('admin-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function handleAction(publication, action, note = '') {
    setBusyId(publication.id);
    setActionError('');
    try {
      if (action === 'approve') {
        await apiRequest(`/api/publications/${publication.id}/status`, { method: 'PATCH', body: { status: 'PUBLISHED', note: '' } });
        showToast({ tone: 'menta', eyebrow: 'Sello puesto', title: 'Publicación aprobada', text: 'Ya está visible en TEJIDO.' });
      } else if (action === 'reject') {
        await apiRequest(`/api/publications/${publication.id}/status`, { method: 'PATCH', body: { status: 'REJECTED', note } });
        showToast({ tone: 'menta', eyebrow: 'Hilo devuelto', title: 'Publicación rechazada', text: 'El gestor verá el motivo para ajustarla.' });
      } else {
        await apiRequest(`/api/publications/${publication.id}`, { method: 'DELETE' });
        showToast({ tone: 'menta', title: 'Publicación eliminada' });
      }
      await load();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  }

  const { publications } = state;
  const pending = publications.filter((item) => item.status === 'REVIEW').length;

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <a className="mb-8 inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline" href="#perfil">
        <Icon name="arrow-left" className="size-4" /> Volver a mi perfil
      </a>
      <header className="mb-10 max-w-[760px]">
        <p className={EYEBROW}>Dashboard de admin</p>
        <h1 className={H1}>Centro de la red</h1>
        <p className="mt-4 mb-0 text-[18px] leading-[1.6] text-[#53645c]">Modera lo que llega a revisión, acompaña a los gestores y cuida todo lo que se publica en TEJIDO.</p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <StatsPanel stats={stats} />

        {editor && (
          <div id="admin-editor" className="scroll-mt-24">
            <PublicationForm
              key={editor.publication?.id ?? 'nueva'}
              publication={editor.publication}
              categories={state.categories}
              allowPublish
              onCancel={() => setEditor(null)}
              onSaved={() => { setEditor(null); load(); }}
            />
          </div>
        )}

        <section className={PANEL} aria-labelledby="admin-publicaciones">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="admin-publicaciones" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="book" className="size-6 text-river" /> Publicaciones</h2>
              <p className="mt-2 mb-0 text-[14px] text-muted">De todos los gestores. {pending ? `${pending} esperando revisión, arriba.` : 'Nada esperando revisión.'}</p>
            </div>
            {!editor && <button type="button" className={LINK_BTN_SOLID} onClick={() => openEditor()}><Icon name="pen" className="size-4" /> Nueva publicación</button>}
          </div>
          {actionError && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{actionError}</p>}
          {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
          {state.error && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>}
          {!state.loading && !state.error && (publications.length ? (
            <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
              {publications.map((publication) => (
                <AdminPublicationItem key={publication.id} publication={publication} busy={busyId === publication.id} onEdit={openEditor} onAction={handleAction} />
              ))}
            </ul>
          ) : (
            <div className="mt-6"><EmptyNote icon="book" title="Aún no hay publicaciones" text="Crea la primera o espera a que los gestores envíen las suyas." /></div>
          ))}
        </section>

        <GestoresPanel />
      </div>
    </section>
  );
}
