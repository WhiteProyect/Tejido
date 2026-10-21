import { useCallback, useEffect, useState } from 'react';
import EmptyNote from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import PublicationCard from '../components/PublicationCard.jsx';
import PublicationForm from '../components/PublicationForm.jsx';
import PillTabs from '../components/admin/PillTabs.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, BTN_INK_SM, EYEBROW, H1, PANEL, PANEL_TITLE, SECTION } from '../components/uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { cdnImage } from '../utils/cloudinaryUrl.js';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { getInitials } from '../utils/initials.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Dashboard del Gestor (#gestor-dashboard[/mis-publicaciones|mi-categoria]). El gestor trabaja
// solo en su categoria (organizations.branch; el backend rechaza otra):
// - Cabecera con su categoria (GET /api/me/category: rama, organizacion, conteos, colegas y lo
//   publicado o en revision por otros autores de la rama). Los conteos filtran su lista.
// - "Mis publicaciones": GET /api/publications?mine=1. Acciones segun el estado editorial:
//   DRAFT: Editar / Enviar / Borrar · REVIEW: ninguna (espera al admin)
//   REJECTED: motivo + Corregir / Reenviar · PUBLISHED: Ver / Editar (vuelve a revision) / Archivar.
// - "Mi categoria": colegas y publicaciones de otros autores de su rama, en solo lectura.
// - Crear/editar: PublicationForm sin allowPublish y con su rama fija. Enviar/Reenviar: POST
//   .../submit. Borrar/Archivar: DELETE (borrado logico).
// La pestana va en la URL con replaceState (sin hashchange: App subiria la pagina).

const CATEGORY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label, slug]) => [key, { label, slug }]));
const TABS = [['mis-publicaciones', 'Mis publicaciones', 'book'], ['mi-categoria', 'Mi categoría', 'people']];
const TAB_IDS = TABS.map(([id]) => id);
const tabFrom = (section) => (TAB_IDS.includes(section) ? section : 'mis-publicaciones');
const STATUS_ORDER = ['DRAFT', 'REVIEW', 'REJECTED', 'PUBLISHED'];
const COUNT_LABELS = { DRAFT: 'Borradores', REVIEW: 'En revisión', REJECTED: 'Rechazadas', PUBLISHED: 'Publicadas' };
const ALERT = 'mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]';
const OUTSIDE_TAG = 'whitespace-nowrap rounded-full bg-[rgba(212,168,67,0.18)] py-0.5 px-2.5 text-[11px] font-bold uppercase tracking-[.08em] text-[#7a5c12]';

function CategoryCover({ slug, label }) {
  const [failed, setFailed] = useState(false);
  if (!slug || failed) {
    return (
      <span className="grid size-24 shrink-0 place-items-center rounded-[22px] bg-[rgba(29,143,163,0.14)] text-[34px] font-extrabold text-[#146f80] max600:size-18 max600:text-[26px]" aria-hidden="true">
        {(label || '?').charAt(0)}
      </span>
    );
  }
  return <img src={`/images/categorias/${slug}.jpg`} alt="" className="size-24 shrink-0 rounded-[22px] object-cover max600:size-18" onError={() => setFailed(true)} />;
}

// Contadores por estado (estilo del Pulso del admin): cada uno filtra la lista; "Todas" la limpia.
function StatusCounters({ counts, filter, onFilter }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + (counts[status] || 0), 0);
  const tiles = [['ALL', 'Todas', total], ...STATUS_ORDER.map((status) => [status, COUNT_LABELS[status], counts[status] || 0])];
  return (
    <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-3 max800:grid-cols-[repeat(3,minmax(0,1fr))] max480:grid-cols-[repeat(2,minmax(0,1fr))]" role="group" aria-label="Filtrar mis publicaciones por estado">
      {tiles.map(([key, label, value]) => {
        const selected = filter === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onFilter(key)}
            className={`flex cursor-pointer flex-col-reverse rounded-[16px] border py-3 pr-3 pl-4 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${selected ? 'border-ink bg-ink text-white' : 'border-[#e2d9ca] bg-white/60 text-ink hover:border-ink'}`}
          >
            <span className={`mt-1.5 text-[12px] font-bold uppercase tracking-[.1em] ${selected ? 'text-white/80' : 'text-muted'}`}>{label}</span>
            <span className="text-[32px] font-extrabold leading-none tracking-[-0.04em]">{value}</span>
          </button>
        );
      })}
    </div>
  );
}

function PublicationItem({ publication, user, branch, busy, onEdit, onAction }) {
  const [confirming, setConfirming] = useState(null); // null | 'delete' | 'edit'
  const [viewing, setViewing] = useState(false);
  const [statusLabel, statusTone] = STATUS_LABELS[publication.status] || [publication.status, STATUS_LABELS.DRAFT[1]];
  const date = formatDateShort(publication.start_date || publication.created_at);
  const removeLabel = publication.status === 'PUBLISHED' ? 'Archivar' : 'Borrar';
  const outside = branch && publication.cultural_category !== branch;

  const removeButtons = confirming === 'delete' ? (
    <>
      <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => onAction(publication, 'delete')}>Sí, {removeLabel.toLowerCase()}</button>
      <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setConfirming(null)}>No</button>
    </>
  ) : (
    <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setConfirming('delete')}>{removeLabel}</button>
  );

  let actions = null;
  if (publication.status === 'DRAFT') {
    actions = (
      <>
        <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onEdit(publication)}><Icon name="pen" className="size-3.5" /> Editar</button>
        <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => onAction(publication, 'submit')}><Icon name="send" className="size-3.5" /> Enviar</button>
        {removeButtons}
      </>
    );
  } else if (publication.status === 'REJECTED') {
    actions = (
      <>
        <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onEdit(publication)}><Icon name="pen" className="size-3.5" /> Corregir</button>
        <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => onAction(publication, 'submit')}><Icon name="send" className="size-3.5" /> Reenviar</button>
      </>
    );
  } else if (publication.status === 'PUBLISHED') {
    actions = (
      <>
        <button type="button" className={BTN_GHOST} aria-expanded={viewing} onClick={() => setViewing(!viewing)}>{viewing ? 'Ocultar' : 'Ver'}</button>
        <button type="button" className={BTN_GHOST} disabled={busy} aria-expanded={confirming === 'edit'} onClick={() => setConfirming(confirming === 'edit' ? null : 'edit')}>
          <Icon name="pen" className="size-3.5" /> Editar
        </button>
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
            {publication.cultural_category && <><span aria-hidden="true">·</span><span>{CATEGORY[publication.cultural_category]?.label}</span></>}
            {date && <><span aria-hidden="true">·</span><span className="normal-case tracking-normal font-semibold">{date}</span></>}
            {outside && <span className={OUTSIDE_TAG}>Fuera de tu categoría</span>}
          </p>
          <h3 className="m-0 font-sans text-[19px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{publication.title}</h3>
          {publication.status === 'REJECTED' && (
            <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Motivo:</strong> {publication.moderation_note || 'El equipo no dejó una nota.'}</p>
          )}
          {publication.status === 'REVIEW' && <p className="mt-2 mb-0 text-[14px] text-muted">Esperando la revisión del equipo de TEJIDO; podrás editarla cuando responda.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max600:justify-start">
          <span className={`rounded-full py-1 px-3 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span>
          {actions}
        </div>
      </div>
      {confirming === 'edit' && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[14px] bg-[rgba(212,168,67,0.16)] py-3 px-4" role="note">
          <p className="m-0 min-w-0 flex-1 basis-[260px] text-[14px] leading-[1.5] text-[#6b4f0e]">
            Al guardar, volverá a revisión y dejará de verse hasta que el equipo la apruebe.
          </p>
          <button type="button" className={BTN_INK_SM} onClick={() => { setConfirming(null); onEdit(publication); }}>Sí, editar</button>
          <button type="button" className={BTN_GHOST} onClick={() => setConfirming(null)}>No</button>
        </div>
      )}
      {viewing && <div className="mt-4"><PublicationCard publication={publication} user={user} /></div>}
    </li>
  );
}

function ColleagueAvatar({ colleague }) {
  const [failed, setFailed] = useState(false);
  return (
    <li className="flex w-[104px] flex-col items-center gap-2 text-center">
      <span className="grid size-[64px] place-items-center overflow-hidden rounded-full border-2 border-[#e2d9ca] bg-cream text-[20px] font-extrabold text-ink" aria-hidden="true">
        {colleague.photo_url && !failed
          ? <img src={cdnImage(colleague.photo_url, { width: 128, fit: 'fill' })} alt="" className="size-full object-cover" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          : getInitials(colleague.name)}
      </span>
      <span className="text-[14px] font-bold leading-[1.25] text-ink">{colleague.name}</span>
    </li>
  );
}

function MyCategory({ category }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section className={PANEL} aria-labelledby="mi-categoria-colegas">
        <h2 id="mi-categoria-colegas" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="people" className="size-6 text-river" /> Colegas de {category.label}</h2>
        {category.colleagues.length ? (
          <ul className="mt-6 mb-0 flex list-none flex-wrap gap-5 p-0">
            {category.colleagues.map((colleague) => <ColleagueAvatar key={colleague.id} colleague={colleague} />)}
          </ul>
        ) : (
          <div className="mt-6"><EmptyNote icon="people" title="Por ahora eres el único gestor de esta categoría" text="Cuando el equipo sume más gestores en tu rama, aparecerán aquí." /></div>
        )}
      </section>

      <section className={PANEL} aria-labelledby="mi-categoria-publicaciones">
        <h2 id="mi-categoria-publicaciones" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="book" className="size-6 text-river" /> En {category.label}</h2>
        <p className="mt-2 mb-0 text-[14px] text-muted">Lo que otros autores publicaron o enviaron a revisión en tu categoría. Solo lectura.</p>
        {category.others.length ? (
          <ul className="mt-4 mb-0 list-none p-0">
            {category.others.map((publication) => {
              const [statusLabel, statusTone] = STATUS_LABELS[publication.status] || [publication.status, STATUS_LABELS.DRAFT[1]];
              const date = formatDateShort(publication.start_date);
              return (
                <li key={publication.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-b-line py-4 last:border-b-0">
                  <div className="min-w-0 flex-1 basis-[280px]">
                    <p className="m-0 mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold uppercase tracking-[.08em] text-muted">
                      <span>{KIND_LABELS[publication.kind] || publication.kind}</span>
                      {date && <><span aria-hidden="true">·</span><span className="normal-case tracking-normal font-semibold">{date}</span></>}
                    </p>
                    <h3 className="m-0 font-sans text-[17px] font-bold leading-[1.3] text-ink">{publication.title}</h3>
                    <p className="mt-1 mb-0 text-[14px] text-[#53645c]">Por <strong className="text-ink">{publication.author}</strong></p>
                  </div>
                  <span className={`rounded-full py-1 px-3 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-6"><EmptyNote icon="book" title="Aún no hay publicaciones de otros autores" text="Cuando tus colegas publiquen en tu categoría, las verás aquí." /></div>
        )}
      </section>
    </div>
  );
}

export default function GestorDashboard({ user, section }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState(() => tabFrom(section));
  const [filter, setFilter] = useState('ALL');
  const [state, setState] = useState({ loading: true, error: '', publications: [], categories: [], category: null });
  const [editor, setEditor] = useState(null); // null | { publication: null | objeto }
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const [publications, categories, category] = await Promise.all([
        apiRequest('/api/publications?mine=1'), apiRequest('/api/categories'), apiRequest('/api/me/category'),
      ]);
      setState({ loading: false, error: '', publications, categories, category });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Enlaces a #gestor-dashboard/<seccion> desde fuera (hashchange) mueven la pestana.
  useEffect(() => {
    const sync = () => setTab(tabFrom(window.location.hash.replace(/^#gestor-dashboard\/?/, '')));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function changeTab(id) {
    setTab(id);
    window.history.replaceState(window.history.state, '', `#gestor-dashboard/${id}`);
  }

  function openEditor(publication = null) {
    setActionError('');
    if (tab !== 'mis-publicaciones') changeTab('mis-publicaciones');
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

  const { publications, category } = state;
  const branch = category?.branch || null;
  const info = branch ? { label: category.label || CATEGORY[branch]?.label, slug: CATEGORY[branch]?.slug } : null;
  const visible = filter === 'ALL' ? publications : publications.filter((publication) => publication.status === filter);
  const ready = !state.loading && !state.error && category;

  return (
    <section className={`${SECTION} min-h-[62vh]`}>
      <a className="mb-8 inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline" href="#perfil">
        <Icon name="arrow-left" className="size-4" /> Volver a mi perfil
      </a>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 max-w-[820px] items-center gap-6 max600:items-start max600:gap-4">
          {ready && branch && <CategoryCover slug={info.slug} label={info.label} />}
          <div className="min-w-0">
            <p className={EYEBROW}>Dashboard de gestor</p>
            <h1 className={H1}>{ready && branch ? info.label : 'Tu taller'}</h1>
            <p className="mt-4 mb-0 text-[18px] leading-[1.6] text-[#53645c]">
              {category?.organization?.name || 'Crea borradores, envíalos a revisión y corrige lo que el equipo te pida.'}
            </p>
            {ready && branch && (
              <a className="mt-3 inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline" href={`#categoria/${info.slug}`}>
                Ver mi categoría <Icon name="arrow-right" className="size-4" />
              </a>
            )}
          </div>
        </div>
        {ready && branch && !editor && <button type="button" className={BTN_INK_MD} onClick={() => openEditor()}><Icon name="pen" className="size-4" /> Nueva publicación</button>}
      </header>

      {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && <p className={ALERT} role="alert">{state.error}</p>}

      {ready && !branch && (
        <section className={PANEL} aria-labelledby="sin-categoria">
          <h2 id="sin-categoria" className={PANEL_TITLE}>Todavía no tienes una categoría asignada</h2>
          <p className="mt-3 mb-0 max-w-[620px] text-[15px] leading-[1.55] text-[#53645c]">
            Escríbele al equipo de TEJIDO para que te asigne tu rama cultural. Cuando la tengas, aquí podrás crear y enviar tus publicaciones.
          </p>
        </section>
      )}

      {ready && branch && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <StatusCounters counts={category.counts} filter={filter} onFilter={(value) => { setFilter(value); if (tab !== 'mis-publicaciones') changeTab('mis-publicaciones'); }} />
          <PillTabs idPrefix="gestor" label="Qué ver" active={tab} onChange={changeTab} tabs={TABS.map(([id, label, icon]) => ({ id, label, icon }))} />

          <div id={`gestor-panel-${tab}`} role="tabpanel" aria-labelledby={`gestor-tab-${tab}`} className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {tab === 'mis-publicaciones' && (
              <>
                {editor && (
                  <PublicationForm
                    key={editor.publication?.id ?? 'nueva'}
                    publication={editor.publication}
                    categories={state.categories}
                    allowPublish={false}
                    fixedCategory={branch}
                    onCancel={() => setEditor(null)}
                    onSaved={() => { setEditor(null); load(); }}
                  />
                )}
                <section className={PANEL} aria-labelledby="mis-publicaciones">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2 id="mis-publicaciones" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="book" className="size-6 text-river" /> Tus publicaciones</h2>
                    {filter !== 'ALL' && (
                      <button type="button" className={BTN_GHOST} onClick={() => setFilter('ALL')}>Ver todas</button>
                    )}
                  </div>
                  {filter !== 'ALL' && <p className="mt-2 mb-0 text-[14px] text-muted">Mostrando: {COUNT_LABELS[filter].toLowerCase()}.</p>}
                  {actionError && <p className={ALERT} role="alert">{actionError}</p>}
                  {visible.length ? (
                    <ul className="mt-2 mb-0 list-none p-0">
                      {visible.map((publication) => (
                        <PublicationItem key={publication.id} publication={publication} user={user} branch={branch} busy={busyId === publication.id} onEdit={openEditor} onAction={handleAction} />
                      ))}
                    </ul>
                  ) : filter !== 'ALL' ? (
                    <div className="mt-6"><EmptyNote icon="book" title={`Sin publicaciones en «${COUNT_LABELS[filter]}»`} text="Elige otro estado o mira todas." /></div>
                  ) : (
                    <div className="mt-6">
                      <EmptyNote
                        icon="pen"
                        title="Tu primer hilo está por tejerse"
                        text="Crea tu primera publicación: queda como borrador hasta que la envíes a revisión."
                        action={!editor && <button type="button" className={BTN_INK_MD} onClick={() => openEditor()}>Crear publicación</button>}
                      />
                    </div>
                  )}
                </section>
              </>
            )}
            {tab === 'mi-categoria' && <MyCategory category={category} />}
          </div>
        </div>
      )}
    </section>
  );
}
