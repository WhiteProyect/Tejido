import { useEffect, useId, useState } from 'react';
import ImageField from '../../ImageField.jsx';
import { useUnsavedChanges } from '../../admin/artist/unsavedChanges.js';
import { HINT, Switch, TextField } from '../../gestor/edit/common.jsx';
import { BTN_INK_OUTLINE_MD, FORM_INPUT, FORM_LABEL } from '../../uiStyles.js';
import { apiRequest } from '../../../utils/api.js';
import { CULTURAL_CATEGORIES, MUNICIPALITIES } from '../../../utils/constants.js';
import { ALERT, LIMITS, SaveBar, talentApi } from './common.jsx';

// Pestaña Datos: lo basico del perfil (POST al crear, PATCH con lo que cambio al editar).
// Lider: categoria fija a su rama; representante = el mismo o un participante activo de su rama
// (GET /api/branches/{rama}/participants). Admin: categoria libre, representante = cualquier gestor
// activo (GET /api/admin/gestores) y ademas verificado (exige acta), acta, fecha, destacado y
// "Guardar y publicar". Al lider esos controles no se le muestran (el backend los rechaza).
const BRANCH_LABEL = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));

function valuesFrom(detail, branch) {
  return {
    name: detail?.name || '',
    category: detail?.category || branch || '',
    origin: detail?.origin || '',
    tagline: detail?.tagline || '',
    description: detail?.description || '',
    cover_url: detail?.cover_url || '',
    representative_user_id: detail?.representative_user_id ? String(detail.representative_user_id) : '',
    verified: Boolean(detail?.verified),
    act_number: detail?.act_number || '',
    act_date: detail?.act_date || '',
    featured: Boolean(detail?.featured),
  };
}

const ADMIN_FIELDS = ['verified', 'act_number', 'act_date', 'featured'];

function useRepresentatives(isAdmin, branch) {
  const [options, setOptions] = useState({ loading: true, items: [], error: '' });
  useEffect(() => {
    let alive = true;
    const request = isAdmin ? apiRequest('/api/admin/gestores') : apiRequest(`/api/branches/${branch}/participants`);
    request
      .then((rows) => {
        if (!alive) return;
        const items = rows.filter((row) => row.active).map((row) => ({
          id: String(row.id),
          label: isAdmin
            ? `${row.name}${row.organization_name ? ` · ${row.organization_name}` : ''}${row.branch ? ` (${BRANCH_LABEL[row.branch] || row.branch})` : ''}`
            : `${row.name}${row.organization ? ` · ${row.organization}` : ''}${row.is_leader ? ' (líder, tú)' : ''}`,
        }));
        setOptions({ loading: false, items, error: '' });
      })
      .catch((error) => alive && setOptions({ loading: false, items: [], error: error.message }));
    return () => { alive = false; };
  }, [isAdmin, branch]);
  return options;
}

export default function DataTab({ role, branch, detail, onSaved, onCreated }) {
  const isAdmin = role === 'ADMIN';
  const id = useId();
  const [initial] = useState(() => valuesFrom(detail, isAdmin ? '' : branch));
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const representatives = useRepresentatives(isAdmin, branch);
  const changed = Object.keys(initial).filter((key) => values[key] !== initial[key]);
  const dirty = changed.length > 0;
  useUnsavedChanges(dirty);
  const set = (name) => (value) => setValues((current) => ({ ...current, [name]: value }));

  function body(publish) {
    const keys = detail ? changed : Object.keys(values);
    const out = {};
    for (const key of keys) {
      if (!isAdmin && (ADMIN_FIELDS.includes(key) || key === 'category')) continue;
      let value = values[key];
      if (typeof value === 'string') value = value.trim();
      if (key === 'representative_user_id') value = value ? Number(value) : null;
      if (key === 'act_date' && value === '') value = null;
      if (!detail && (value === '' || value === null)) continue;
      out[key] = value;
    }
    if (publish) out.publish = true;
    return out;
  }

  function check() {
    if (!values.name.trim()) return 'El nombre es requerido.';
    if (isAdmin && !values.category) return 'Elige la categoría.';
    if (!values.origin) return 'Elige el municipio de origen.';
    if (values.tagline.length > LIMITS.tagline) return `La frase de presentación no puede superar ${LIMITS.tagline} caracteres.`;
    if (isAdmin && values.verified && !values.act_number.trim()) return 'Para marcarlo como verificado escribe el número del acta.';
    return '';
  }

  async function save(publish = false) {
    const problem = check();
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      if (!detail) {
        const created = await talentApi.create(body(publish));
        onCreated(created);
        return;
      }
      await talentApi.patch(detail.id, body(publish));
      await onSaved(publish ? { title: 'Talento publicado', text: 'Ya se ve en el listado de talento.' } : { title: 'Datos guardados', reviewNote: true });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  const currentRep = detail?.representative && !representatives.items.some((item) => item.id === String(detail.representative.id))
    ? [{ id: String(detail.representative.id), label: `${detail.representative.name} (actual)` }] : [];

  return (
    <form onSubmit={(event) => { event.preventDefault(); save(false); }} noValidate aria-label="Datos del talento" className="grid gap-5">
      <div className="grid grid-cols-[1fr_1fr] gap-5 max600:grid-cols-[1fr]">
        <TextField label="Nombre" value={values.name} onChange={set('name')} max={LIMITS.name} counter inputProps={{ required: true }} />
        {isAdmin ? (
          <label className={FORM_LABEL}>Categoría
            <select className={FORM_INPUT} value={values.category} onChange={(event) => set('category')(event.target.value)} required>
              <option value="">Elige una categoría</option>
              {CULTURAL_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        ) : (
          <p className={`${FORM_LABEL} m-0`}>Categoría<span className="py-2.5 text-[15px] font-bold normal-case tracking-normal text-ink">{BRANCH_LABEL[branch]} (tu rama)</span></p>
        )}
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-origin`} className={FORM_LABEL}>Municipio de origen</label>
          <select id={`${id}-origin`} className={FORM_INPUT} value={values.origin} onChange={(event) => set('origin')(event.target.value)} aria-describedby={`${id}-origin-hint`} required>
            <option value="">Elige un municipio</option>
            {MUNICIPALITIES.map(({ id: key, name }) => <option key={key} value={key}>{name}</option>)}
          </select>
          <p id={`${id}-origin-hint`} className={HINT}>De dónde viene este talento.</p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-rep`} className={FORM_LABEL}>Representante</label>
          <select id={`${id}-rep`} className={FORM_INPUT} value={values.representative_user_id} onChange={(event) => set('representative_user_id')(event.target.value)}
            disabled={representatives.loading} aria-describedby={`${id}-rep-hint`}>
            <option value="">Sin representante</option>
            {[...currentRep, ...representatives.items].map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <p id={`${id}-rep-hint`} className={HINT}>
            {representatives.error || (isAdmin ? 'Cualquier gestor activo.' : 'Tú o un participante activo de tu rama. Su perfil de gestor se enlaza desde el talento.')}
          </p>
        </div>
      </div>

      <TextField label="Frase de presentación" value={values.tagline} onChange={set('tagline')} max={LIMITS.tagline} counter multiline rows={2}
        hint="Una o dos líneas: se ve bajo el nombre en el perfil." />
      <TextField label="Descripción (opcional)" value={values.description} onChange={set('description')} max={LIMITS.description} counter multiline rows={5}
        hint="Su historia en pocas palabras: aparece en Historia / Trayectoria." />
      <ImageField label="Foto de portada" value={values.cover_url} onChange={set('cover_url')} scope="talent"
        hint="Mejor horizontal (16:9), por ejemplo 1600 × 900 px: se recorta en la tarjeta y en la cabecera del perfil." />

      {isAdmin && (
        <fieldset className="m-0 grid gap-4 rounded-[18px] border border-line bg-white/70 p-5">
          <legend className="px-1 text-[13px] font-extrabold uppercase tracking-[.1em] text-[#53645c]">Solo el equipo de TEJIDO</legend>
          <Switch checked={values.verified} onChange={set('verified')} label="Verificado por Tejido" description="Muestra el sello dorado. Exige el número del acta." />
          <div className="grid grid-cols-[1fr_1fr] gap-4 max600:grid-cols-[1fr]">
            <TextField label="Número de acta" value={values.act_number} onChange={set('act_number')} max={LIMITS.actNumber} counter />
            <TextField label="Fecha del acta" type="date" value={values.act_date} onChange={set('act_date')} />
          </div>
          <Switch checked={values.featured} onChange={set('featured')} label="Destacado" description="Aparece primero en el listado de talento." />
        </fieldset>
      )}

      {error && <p className={ALERT} role="alert">{error}</p>}
      <SaveBar busy={busy} dirty={dirty} label={detail ? 'Guardar datos' : 'Crear talento'}>
        {isAdmin && detail?.status !== 'PUBLISHED' && (
          <button type="button" className={`${BTN_INK_OUTLINE_MD} max480:w-full`} disabled={busy} onClick={() => save(true)}>
            {detail ? 'Guardar y publicar' : 'Crear y publicar'}
          </button>
        )}
      </SaveBar>
    </form>
  );
}
