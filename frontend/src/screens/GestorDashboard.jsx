import { useCallback, useEffect, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import PublicationCard from '../components/PublicationCard.jsx';
import PublicationForm from '../components/PublicationForm.jsx';
import { BTN_DANGER, BTN_DARK, BTN_GHOST, EYEBROW, H1, LINK_BTN_SOLID, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Dashboard del Gestor (#gestor-dashboard): CRUD real de sus publicaciones contra la API.
// - Lista: GET /api/publications?mine=1. Acciones segun el estado editorial:
//   DRAFT: Editar / Enviar / Borrar · REVIEW: ninguna (espera al admin)
//   REJECTED: motivo + Corregir / Reenviar · PUBLISHED: Ver / Archivar.
// - Crear/editar: components/PublicationForm.jsx sin allowPublish (nunca publica: el admin
//   aprueba). Enviar/Reenviar: POST .../submit. Borrar/Archivar: DELETE (borrado logico).

const CATEGORY_LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));

function PublicationItem({ publication, user, busy, onEdit, onAction }) {
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [statusLabel, statusTone] = STATUS_LABELS[publication.status] || [publication.status, STATUS_LABELS.DRAFT[1]];
  const date = formatDateShort(publication.start_date || publication.created_at);
  const removeLabel = publication.status === 'PUBLISHED' ? 'Archivar' : 'Borrar';

  const removeButtons = confirming ? (
    <>
      <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => onAction(publication, 'delete')}>Sí, {removeLabel.toLowerCase()}</button>
      <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setConfirming(false)}>No</button>
    </>
  ) : (
    <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setConfirming(true)}>{removeLabel}</button>
  );

  let actions = null;
  if (publication.status === 'DRAFT') {
    actions = (
      <>
        <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onEdit(publication)}><Icon name="pen" className="size-3.5" /> Editar</button>
        <button type="button" className={BTN_DARK} disabled={busy} onClick={() => onAction(publication, 'submit')}><Icon name="send" className="size-3.5" /> Enviar</button>
        {removeButtons}
      </>
    );
  } else if (publication.status === 'REJECTED') {
    actions = (
      <>
        <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onEdit(publication)}><Icon name="pen" className="size-3.5" /> Corregir</button>
        <button type="button" className={BTN_DARK} disabled={busy} onClick={() => onAction(publication, 'submit')}><Icon name="send" className="size-3.5" /> Reenviar</button>
      </>
    );
  } else if (publication.status === 'PUBLISHED') {
    actions = (
      <>
        <button type="button" className={BTN_GHOST} aria-expanded={viewing} onClick={() => setViewing(!viewing)}>{viewing ? 'Ocultar' : 'Ver'}</button>
        {removeButtons}
      </>
    );
  }

  return (
    <li className="border-b border-b-line py-5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[320px]">
          <p className="m-0 mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold uppercase tracking-[.08em] text-muted">
            <span>{KIND_LABELS[publication.kind] || publication.kind}</span>
            {publication.cultural_category && <><span aria-hidden="true">·</span><span>{CATEGORY_LABELS[publication.cultural_category]}</span></>}
            {date && <><span aria-hidden="true">·</span><span className="normal-case tracking-normal font-semibold">{date}</span></>}
          </p>
          <h3 className="m-0 font-sans text-[19px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{publication.title}</h3>
          {publication.status === 'REJECTED' && (
            <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Motivo:</strong> {publication.moderation_note || 'El equipo no dejó una nota.'}</p>
          )}
          {publication.status === 'REVIEW' && <p className="mt-2 mb-0 text-[14px] text-muted">Esperando la revisión del equipo de TEJIDO.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max600:justify-start">
          <span className={`rounded-full py-1 px-3 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span>
          {actions}
        </div>
      </div>
      {viewing && <div className="mt-4"><PublicationCard publication={publication} user={user} /></div>}
    </li>
  );
}

export default function GestorDashboard({ user }) {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: '', publications: [], categories: [] });
  const [editor, setEditor] = useState(null); // null | { publication: null | objeto }
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const [publications, categories] = await Promise.all([apiRequest('/api/publications?mine=1'), apiRequest('/api/categories')]);
      setState({ loading: false, error: '', publications, categories });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEditor(publication = null) {
    setActionError('');
    setEditor({ publication });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAction(publication, action) {
    setBusyId(publication.id);
    setActionError('');
    try {
      if (action === 'submit') {
        await apiRequest(`/api/publications/${publication.id}/submit`, { method: 'POST' });
        showToast({ tone: 'menta', eyebrow: 'Hilo en camino', title: 'Enviada a revisión', text: 'El equipo la revisará pronto.' });
      } else {
        await apiRequest(`/api/publications/${publication.id}`, { method: 'DELETE' });
        showToast(publication.status === 'PUBLISHED'
          ? { tone: 'menta', title: 'Publicación archivada' }
          : { tone: 'menta', title: 'Borrador eliminado' });
      }
      await load();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  }

  const { publications } = state;

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <a className="mb-8 inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline" href="#perfil">
        <Icon name="arrow-left" className="size-4" /> Volver a mi perfil
      </a>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[720px]">
          <p className={EYEBROW}>Dashboard de gestor</p>
          <h1 className={H1}>Taller de Eventos y Cultura</h1>
          <p className="mt-4 mb-0 text-[18px] leading-[1.6] text-[#53645c]">Crea borradores, envíalos a revisión y corrige lo que el equipo te pida. Nada se publica sin aprobación.</p>
        </div>
        {!editor && <button type="button" className={LINK_BTN_SOLID} onClick={() => openEditor()}><Icon name="pen" className="size-4" /> Nueva publicación</button>}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        {editor && (
          <PublicationForm
            key={editor.publication?.id ?? 'nueva'}
            publication={editor.publication}
            categories={state.categories}
            allowPublish={false}
            onCancel={() => setEditor(null)}
            onSaved={() => { setEditor(null); load(); }}
          />
        )}

        <section className={PANEL} aria-labelledby="mis-publicaciones">
          <h2 id="mis-publicaciones" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="book" className="size-6 text-river" /> Tus publicaciones</h2>
          {actionError && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{actionError}</p>}
          {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
          {state.error && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>}
          {!state.loading && !state.error && (publications.length ? (
            <ul className="mt-2 mb-0 list-none p-0">
              {publications.map((publication) => (
                <PublicationItem key={publication.id} publication={publication} user={user} busy={busyId === publication.id} onEdit={openEditor} onAction={handleAction} />
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <EmptyNote
                icon="pen"
                title="Tu primer hilo está por tejerse"
                text="Crea tu primera publicación: queda como borrador hasta que la envíes a revisión."
                action={!editor && <button type="button" className={LINK_BTN_SOLID} onClick={() => openEditor()}>Crear mi primera publicación</button>}
              />
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
