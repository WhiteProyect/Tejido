import { useCallback, useEffect, useState } from 'react';
import Icon from '../../Icon.jsx';
import { RejectForm } from '../../Moderation.jsx';
import PillTabs from '../../admin/PillTabs.jsx';
import { confirmDiscard } from '../../admin/artist/unsavedChanges.js';
import { BTN_GHOST, BTN_INK_SM, PANEL } from '../../uiStyles.js';
import TalentSeal from '../TalentSeal.jsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { categoryOrigin } from '../../../utils/talent.js';
import AvailabilityTab from './AvailabilityTab.jsx';
import DataTab from './DataTab.jsx';
import { ENDORSEMENTS, MILESTONES, SERVICES, SPECS, VENUES } from './listConfigs.js';
import ListTab from './ListTab.jsx';
import PortfolioTab from './PortfolioTab.jsx';
import { ALERT, StatusBadge, TALENT_TOASTS, managePath, talentApi } from './common.jsx';

// Editor de un talento (crear o editar) con 8 pestañas que guardan cada una por separado. Crear:
// solo Datos (POST); al crearse, la URL pasa a <id>/servicios y se habilitan las demas (el talento
// ya existe, necesario para subir imagenes). La pestaña va en la URL con replaceState. Cambios sin
// guardar: aviso al cambiar de pestaña o volver a la lista (components/admin/artist/unsavedChanges).
// Lider: aviso persistente si el talento estaba publicado (al guardar vuelve a revision; la
// disponibilidad no cuenta) y "Enviar a revision". Admin: aprobar, rechazar y publicar.
export const TABS = [
  ['datos', 'Datos', 'pen'],
  ['servicios', 'Servicios', 'check'],
  ['ficha', 'Ficha técnica', 'columns'],
  ['disponibilidad', 'Disponibilidad', 'calendar'],
  ['portafolio', 'Portafolio', 'palette'],
  ['trayectoria', 'Trayectoria', 'sprout'],
  ['respaldo', 'Respaldo', 'seal'],
  ['presentaciones', 'Presentaciones', 'pin'],
];
const TAB_IDS = TABS.map(([id]) => id);
const tabFrom = (value) => (TAB_IDS.includes(value) ? value : 'datos');
const COUNTS = { servicios: 'services', ficha: 'specs', portafolio: 'media', trayectoria: 'milestones', respaldo: 'endorsements', presentaciones: 'venues' };

// Lo que falta para enviar a revision (mensaje del backend) -> pestañas donde se completa.
export function missingTabs(message) {
  const text = String(message || '').toLowerCase();
  if (!text.includes('falta')) return [];
  const tabs = [];
  if (/nombre|categor|municipio|frase|portada/.test(text)) tabs.push('datos');
  if (/servicio/.test(text)) tabs.push('servicios');
  return tabs;
}

export default function TalentEditor({ role, branch, talentId, tab: tabFromUrl, onChanged }) {
  const { showToast } = useToast();
  const isAdmin = role === 'ADMIN';
  const [tab, setTab] = useState(() => (talentId ? tabFrom(tabFromUrl) : 'datos'));
  const [state, setState] = useState({ loading: Boolean(talentId), error: '', detail: null });
  const [wasPublished, setWasPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [topError, setTopError] = useState(null); // { message, tabs }

  useEffect(() => { if (talentId) setTab(tabFrom(tabFromUrl)); }, [tabFromUrl, talentId]);

  const reload = useCallback(async () => {
    if (!talentId) return null;
    try {
      const detail = await talentApi.detail(talentId);
      setState({ loading: false, error: '', detail });
      return detail;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
      return null;
    }
  }, [talentId]);

  useEffect(() => {
    reload().then((detail) => { if (detail?.status === 'PUBLISHED') setWasPublished(true); });
  }, [reload]);

  function changeTab(id) {
    if (id === tab || !talentId || !confirmDiscard()) return;
    setTab(id);
    setTopError(null);
    window.history.replaceState(window.history.state, '', `#${managePath(role, talentId, id)}`);
  }

  // Tras guardar una pestaña: recarga (estado y listas) y avisa al dashboard (contadores).
  async function afterSave(toast) {
    const detail = await reload();
    onChanged?.();
    const back = !isAdmin && detail?.status === 'REVIEW' && toast?.reviewNote;
    showToast({ tone: 'menta', title: toast?.title || 'Cambios guardados', text: back ? 'Volvió a revisión: el equipo lo aprobará de nuevo.' : toast?.text });
  }

  function handleCreated(created) {
    showToast({ tone: 'menta', eyebrow: 'Nuevo talento', title: 'Talento creado', text: 'Ahora completa sus servicios y las demás pestañas.' });
    onChanged?.();
    window.location.hash = managePath(role, created.id, 'servicios');
  }

  async function run(action, note = '') {
    setBusy(true);
    setTopError(null);
    try {
      if (action === 'submit') await talentApi.submit(talentId);
      else if (action === 'approve') await talentApi.moderate(talentId, 'PUBLISHED');
      else if (action === 'reject') await talentApi.moderate(talentId, 'REJECTED', note);
      else if (action === 'publish') await talentApi.patch(talentId, { publish: true });
      setRejecting(false);
      await reload();
      showToast(TALENT_TOASTS[action]);
      onChanged?.();
    } catch (error) {
      setTopError({ message: error.message, tabs: missingTabs(error.message) });
    } finally {
      setBusy(false);
    }
  }

  const backHref = `#${managePath(role)}`;
  const back = (
    <a className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      href={backHref} onClick={(event) => { if (!confirmDiscard()) event.preventDefault(); }}>
      <Icon name="arrow-left" className="size-4" /> Volver a la lista
    </a>
  );

  if (talentId && !state.detail) {
    return (
      <section className={PANEL} aria-busy={state.loading}>
        {back}
        {state.loading ? <p className="m-0 pt-6 text-[14px] text-muted">Cargando el talento...</p> : <p className={`${ALERT} mt-6`} role="alert">{state.error}</p>}
      </section>
    );
  }

  const detail = state.detail;
  const status = detail?.status;
  const canSubmit = !isAdmin && ['DRAFT', 'REJECTED'].includes(status);
  const tabProps = { role, branch, detail, onSaved: afterSave };

  return (
    <section className={PANEL} aria-labelledby="talento-editor-titulo">
      {back}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {detail && <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[.08em] text-muted">{categoryOrigin(detail)}</p>}
          <h2 id="talento-editor-titulo" className="m-0 flex flex-wrap items-center gap-3 font-sans text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink [overflow-wrap:anywhere]">
            {detail ? detail.name : 'Nuevo talento'}
            {detail && <StatusBadge status={status} />}
            {detail?.verified && <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#7a5c12]"><TalentSeal className="size-5" /> Verificado · Acta {detail.act_number}</span>}
          </h2>
        </div>
        {detail && (
          <div className="flex flex-wrap items-center gap-2">
            <a className={BTN_GHOST} href={`#talento-vista-previa/${detail.id}`} onClick={(event) => { if (!confirmDiscard()) event.preventDefault(); }}>Vista previa</a>
            {canSubmit && <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => run('submit')}>Enviar a revisión</button>}
            {isAdmin && status === 'REVIEW' && (
              <>
                <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => run('approve')}><Icon name="check" className="size-3.5" /> Aprobar</button>
                <button type="button" className={BTN_GHOST} disabled={busy} aria-expanded={rejecting} onClick={() => setRejecting(!rejecting)}>Rechazar</button>
              </>
            )}
            {isAdmin && ['DRAFT', 'REJECTED'].includes(status) && (
              <button type="button" className={BTN_INK_SM} disabled={busy} onClick={() => run('publish')}>Publicar</button>
            )}
          </div>
        )}
      </div>

      {rejecting && <RejectForm busy={busy} onSubmit={(note) => run('reject', note)} onCancel={() => setRejecting(false)} />}
      {topError && (
        <div className={`${ALERT} mt-4 grid gap-2`} role="alert">
          <p className="m-0">{topError.message}</p>
          {topError.tabs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topError.tabs.map((id) => (
                <button key={id} type="button" className={BTN_GHOST} onClick={() => changeTab(id)}>Ir a {TABS.find(([tabId]) => tabId === id)[1]}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {status === 'REJECTED' && detail.moderation_note && (
        <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Motivo del rechazo:</strong> {detail.moderation_note}</p>
      )}
      {status === 'REVIEW' && !isAdmin && (
        <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(212,168,67,0.12)] py-3 px-4 text-[14px] leading-[1.5] text-[#5c4510]" role="status">
          Está en revisión: puedes seguir ajustándolo mientras el equipo lo revisa.
        </p>
      )}
      {!isAdmin && wasPublished && (
        <p className="mt-4 mb-0 rounded-[14px] border border-[rgba(212,168,67,0.6)] bg-[rgba(212,168,67,0.12)] py-3 px-4 text-[14px] leading-[1.5] text-[#5c4510]" role="note">
          <strong>Este talento está publicado.</strong> Al editarlo vuelve a revisión y se oculta del sitio hasta que el equipo lo apruebe.
        </p>
      )}

      <div className="mt-6">
        <PillTabs
          idPrefix="talento-editor"
          size="compact"
          label={detail ? `Secciones de ${detail.name}` : 'Secciones del talento'}
          active={tab}
          onChange={changeTab}
          tabs={TABS.filter(([id]) => detail || id === 'datos').map(([id, label, icon]) => ({
            id, label, icon,
            ...(detail && COUNTS[id] ? { badge: detail[COUNTS[id]].length, badgeLabel: 'elementos', badgeTone: 'neutral' } : {}),
          }))}
        />
        {!detail && <p className="mt-3 mb-0 text-[14px] text-muted">Guarda los datos para habilitar las demás pestañas (servicios, portafolio, agenda...).</p>}
      </div>

      <div id={`talento-editor-panel-${tab}`} role="tabpanel" aria-labelledby={`talento-editor-tab-${tab}`} className="mt-6">
        {tab === 'datos' && <DataTab key={detail?.updated_at || 'nuevo'} {...tabProps} onCreated={handleCreated} />}
        {detail && tab === 'servicios' && <ListTab key={`s-${detail.updated_at}`} {...tabProps} config={SERVICES} />}
        {detail && tab === 'ficha' && <ListTab key={`f-${detail.updated_at}`} {...tabProps} config={SPECS} />}
        {detail && tab === 'disponibilidad' && <AvailabilityTab key={`d-${detail.updated_at}`} {...tabProps} />}
        {detail && tab === 'portafolio' && <PortfolioTab key={`p-${detail.updated_at}`} {...tabProps} />}
        {detail && tab === 'trayectoria' && <ListTab key={`t-${detail.updated_at}`} {...tabProps} config={MILESTONES} />}
        {detail && tab === 'respaldo' && <ListTab key={`r-${detail.updated_at}`} {...tabProps} config={ENDORSEMENTS} />}
        {detail && tab === 'presentaciones' && <ListTab key={`v-${detail.updated_at}`} {...tabProps} config={VENUES} />}
      </div>
    </section>
  );
}
