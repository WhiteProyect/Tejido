import { useCallback, useEffect, useMemo, useState } from 'react';
import EmptyNote from '../../EmptyNote.jsx';
import Icon from '../../Icon.jsx';
import { RejectForm } from '../../Moderation.jsx';
import { ConfirmDialog } from '../../gestor/edit/common.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, BTN_INK_SM, FORM_INPUT, FORM_LABEL, PANEL, PANEL_TITLE } from '../../uiStyles.js';
import TalentSeal from '../TalentSeal.jsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';
import { CULTURAL_CATEGORIES } from '../../../utils/constants.js';
import { formatDateShort } from '../../../utils/dateUtils.js';
import { categoryColor, categoryOrigin, categoryTint, initials } from '../../../utils/talent.js';
import { ALERT, StatusBadge, TALENT_TOASTS, managePath, talentApi } from './common.jsx';
import TalentEditor, { TABS as EDITOR_TABS, missingTabs } from './TalentEditor.jsx';

// Gestion del talento contratable, compartida por el admin (#admin-dashboard/talento) y el lider
// de rama (#gestor-dashboard/talento). role: 'ADMIN' | 'LEADER'; branch: la rama del lider. Los
// permisos los decide el backend (el lider solo ve y toca su rama); aqui solo se ofrecen las
// acciones que le corresponden a cada rol. subpath: '' (lista), 'nuevo' o '<id>[/<pestaña>]'.
// Lista: GET /api/talent/manage (todo de una vez; contadores y filtros en el navegador).
const STATUS_FILTERS = [['ALL', 'Todos'], ['DRAFT', 'Borradores'], ['REVIEW', 'En revisión'], ['REJECTED', 'Rechazados'], ['PUBLISHED', 'Publicados']];
const ORDER = ['REVIEW', 'REJECTED', 'DRAFT', 'PUBLISHED'];
const FILTER = 'inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border-0 py-2 px-4 text-[14px] font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

function Cover({ talent }) {
  if (talent.cover_url) {
    return <img src={cdnImage(talent.cover_url, { width: 160, fit: 'fill' })} alt="" className="size-16 shrink-0 rounded-[12px] object-cover" />;
  }
  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-[12px] font-display text-[24px] font-bold italic" aria-hidden="true"
      style={{ backgroundColor: categoryTint(talent.category), color: categoryColor(talent.category) }}>
      {initials(talent.name)}
    </span>
  );
}

function TalentRow({ talent, role, busy, onAction }) {
  const [mode, setMode] = useState(null); // null | 'reject' | 'archive'
  const isAdmin = role === 'ADMIN';
  const canSubmit = !isAdmin && ['DRAFT', 'REJECTED'].includes(talent.status);
  const inReview = talent.status === 'REVIEW';
  return (
    <li className={`border-b border-b-line py-5 last:border-b-0 ${inReview && isAdmin ? 'rounded-[16px] bg-[rgba(212,168,67,0.08)] px-4 max600:px-3' : ''}`}>
      <div className="flex flex-wrap items-start gap-4">
        <Cover talent={talent} />
        <div className="min-w-0 flex-1 basis-[260px]">
          <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[.08em] text-muted">{categoryOrigin(talent)}</p>
          <h3 className="m-0 flex flex-wrap items-center gap-2 font-sans text-[19px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
            {talent.name}
            {talent.verified && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#7a5c12]"><TalentSeal className="size-5" /> Verificado · Acta {talent.act_number}</span>
            )}
            {talent.featured && <span className="rounded-full bg-[rgba(212,168,67,0.18)] py-0.5 px-2.5 text-[11px] font-bold uppercase tracking-[.08em] text-[#7a5c12]">Destacado</span>}
          </h3>
          <p className="mt-1 mb-0 text-[13px] text-[#53645c]">Actualizado el {formatDateShort(talent.updated_at)}{talent.representative ? ` · Representa: ${talent.representative.name}` : ''}</p>
          {talent.status === 'REJECTED' && talent.moderation_note && (
            <p className="mt-2 mb-0 rounded-[12px] bg-[rgba(216,91,54,.08)] py-2 px-3 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Motivo del rechazo:</strong> {talent.moderation_note}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max600:w-full max600:justify-start">
          <StatusBadge status={talent.status} />
          {isAdmin && inReview && (
            <>
              <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => onAction(talent, 'approve')} aria-label={`Aprobar a ${talent.name}`}>
                <Icon name="check" className="size-3.5" /> Aprobar
              </button>
              <button type="button" className={BTN_GHOST} disabled={busy} aria-expanded={mode === 'reject'} onClick={() => setMode(mode === 'reject' ? null : 'reject')} aria-label={`Rechazar a ${talent.name}`}>
                Rechazar
              </button>
            </>
          )}
          {canSubmit && (
            <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => onAction(talent, 'submit')} aria-label={`Enviar a revisión a ${talent.name}`}>
              Enviar a revisión
            </button>
          )}
          <a className={BTN_GHOST} href={`#${managePath(role, talent.id)}`} aria-label={`Editar a ${talent.name}`}><Icon name="pen" className="size-3.5" /> Editar</a>
          <a className={BTN_GHOST} href={`#talento-vista-previa/${talent.id}`} aria-label={`Vista previa de ${talent.name}`}>Vista previa</a>
          {talent.status === 'PUBLISHED' && (
            <a className={BTN_GHOST} href={`#talento/${talent.slug}`} target="_blank" rel="noopener noreferrer">
              Ver en el sitio<span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          )}
          {isAdmin && (
            <button type="button" className={BTN_GHOST} disabled={busy} aria-pressed={talent.featured} onClick={() => onAction(talent, 'feature')}>
              {talent.featured ? 'Quitar destacado' : 'Destacar'}
            </button>
          )}
          <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => setMode('archive')} aria-label={`Archivar a ${talent.name}`}>Archivar</button>
        </div>
      </div>
      {mode === 'reject' && <RejectForm busy={busy} onSubmit={(note) => onAction(talent, 'reject', note)} onCancel={() => setMode(null)} />}
      {mode === 'archive' && (
        <ConfirmDialog
          title={`¿Archivar a ${talent.name}?`}
          text="Desaparece del sitio y de esta lista: deja de verse en el listado de talento y en su perfil. Esta acción no se deshace desde aquí."
          confirmLabel="Sí, archivar" danger
          onConfirm={() => { setMode(null); onAction(talent, 'archive'); }}
          onCancel={() => setMode(null)}
        />
      )}
    </li>
  );
}

function TalentList({ role, branch, onChanged }) {
  const { showToast } = useToast();
  const isAdmin = role === 'ADMIN';
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null); // { message, missing: [tab...] } | null

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await talentApi.list();
      setState({ loading: false, error: '', items: data.items });
    } catch (error) {
      setState({ loading: false, error: error.message, items: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(talent, action, note = '') {
    setBusyId(talent.id);
    setActionError(null);
    try {
      if (action === 'approve') await talentApi.moderate(talent.id, 'PUBLISHED');
      else if (action === 'reject') await talentApi.moderate(talent.id, 'REJECTED', note);
      else if (action === 'submit') await talentApi.submit(talent.id);
      else if (action === 'archive') await talentApi.remove(talent.id);
      else if (action === 'feature') await talentApi.patch(talent.id, { featured: !talent.featured });
      if (TALENT_TOASTS[action]) showToast(TALENT_TOASTS[action]);
      else showToast({ tone: 'menta', title: talent.featured ? 'Ya no está destacado' : 'Talento destacado' });
      await load();
      onChanged?.();
    } catch (error) {
      setActionError({ message: error.message, id: talent.id });
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => state.items.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), { ALL: state.items.length }), [state.items]);
  const visible = state.items
    .filter((item) => status === 'ALL' || item.status === status)
    .filter((item) => !category || item.category === category)
    .filter((item) => !query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || String(b.updated_at).localeCompare(String(a.updated_at)));
  const branchLabel = CULTURAL_CATEGORIES.find(([key]) => key === branch)?.[1];

  return (
    <section className={PANEL} aria-labelledby="talento-gestion">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="talento-gestion" className={`${PANEL_TITLE} flex items-center gap-3`}><Icon name="mic" className="size-6 text-river" /> Talento</h2>
          <p className="mt-2 mb-0 max-w-[620px] text-[14px] text-muted">
            {isAdmin
              ? 'Los portafolios de contratación de todas las ramas. Lo que llega a revisión espera tu aprobación.'
              : `Los portafolios de contratación de ${branchLabel || 'tu rama'}. Los creas y los envías a revisión; el equipo de TEJIDO los aprueba.`}
          </p>
        </div>
        <a className={BTN_INK_MD} href={`#${managePath(role, 'nuevo')}`}><Icon name="pen" className="size-4" /> Nuevo talento</a>
      </div>

      <div className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-cream p-1" role="group" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}
            className={`${FILTER} ${status === value ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`}>
            {label} <span className={`rounded-full px-2 text-[12px] ${status === value ? 'bg-white/20' : value === 'REVIEW' && counts.REVIEW ? 'bg-[#a8431f] text-white' : 'bg-[rgba(23,63,54,.08)]'}`}>{counts[value] || 0}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,260px)] gap-4 max600:grid-cols-[minmax(0,1fr)]">
        <label className={FORM_LABEL}>Buscar por nombre
          <input className={FORM_INPUT} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre del talento" />
        </label>
        {isAdmin ? (
          <label className={FORM_LABEL}>Categoría
            <select className={FORM_INPUT} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Todas las categorías</option>
              {CULTURAL_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        ) : (
          <p className={`${FORM_LABEL} m-0`}>Categoría<span className="py-2.5 text-[15px] font-bold normal-case tracking-normal text-ink">{branchLabel}</span></p>
        )}
      </div>

      {actionError && (
        <div className={`${ALERT} mt-4 grid gap-2`} role="alert">
          <p className="m-0">{actionError.message}</p>
          {missingTabs(actionError.message).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {missingTabs(actionError.message).map((tabId) => (
                <a key={tabId} className={BTN_GHOST} href={`#${managePath(role, actionError.id, tabId)}`}>Ir a {EDITOR_TABS.find(([id]) => id === tabId)[1]}</a>
              ))}
            </div>
          )}
        </div>
      )}
      {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className={ALERT} role="alert">{state.error}</p>
          <button type="button" className={BTN_GHOST} onClick={load}>Reintentar</button>
        </div>
      )}
      {!state.loading && !state.error && (visible.length ? (
        <>
          <p className="sr-only" aria-live="polite">{visible.length} {visible.length === 1 ? 'talento' : 'talentos'}</p>
          <ul className="mt-4 mb-0 grid list-none gap-1 p-0">
            {visible.map((talent) => (
              <TalentRow key={talent.id} talent={talent} role={role} busy={busyId === talent.id} onAction={handleAction} />
            ))}
          </ul>
        </>
      ) : state.items.length ? (
        <div className="mt-6"><EmptyNote icon="search" title="Nada con esos filtros" text="Prueba con otro estado, otra categoría o un nombre más corto." /></div>
      ) : (
        <div className="mt-6">
          <EmptyNote icon="mic" title="Aún no hay talento aquí"
            text={isAdmin ? 'Crea el primer portafolio o espera a que los líderes de rama envíen los suyos.' : 'Crea el primer portafolio de tu rama: queda como borrador hasta que lo envíes a revisión.'}
            action={<a className={BTN_INK_MD} href={`#${managePath(role, 'nuevo')}`}>Crear talento</a>} />
        </div>
      ))}
    </section>
  );
}

export default function TalentManager({ role, branch, subpath = '', onChanged }) {
  const [id, tab] = subpath.split('/');
  if (id === 'nuevo') return <TalentEditor key="nuevo" role={role} branch={branch} talentId={null} onChanged={onChanged} />;
  if (/^\d+$/.test(id || '')) return <TalentEditor key={id} role={role} branch={branch} talentId={Number(id)} tab={tab} onChanged={onChanged} />;
  return <TalentList role={role} branch={branch} onChanged={onChanged} />;
}
