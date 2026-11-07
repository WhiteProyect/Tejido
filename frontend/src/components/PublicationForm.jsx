import { useEffect, useId, useRef, useState } from 'react';
import DatePicker from './DatePicker.jsx';
import Icon from './Icon.jsx';
import ImageField from './ImageField.jsx';
import LocationPicker from './LocationPicker.jsx';
import PlaceIcon from './PlaceIcon.jsx';
import RequirementsInput from './RequirementsInput.jsx';
import TagsInput from './TagsInput.jsx';
import { BTN_GHOST, BTN_INK_MD, BTN_INK_OUTLINE_MD, FORM_INPUT, FORM_LABEL, PANEL, PANEL_TITLE, placeColors } from './uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { CULTURAL_CATEGORIES, KIND_LABELS, MUNICIPALITIES } from '../utils/constants.js';
import { STATUS_LABELS } from '../utils/publicationStatus.js';

// Formulario de crear/editar publicacion, compartido por el Dashboard del Gestor y el del
// Admin. POST /api/publications (crear) o PUT /api/publications/{id} (editar).
// - category_id no se pregunta: es la categoria de GET /api/categories cuyo type es el kind.
// - allowPublish (admin): categoria libre y casilla para publicar sin pasar por revision; manda
//   publish: true en el mismo POST o PUT. Al editar, el backend conserva el estado si no se marca.
// - Sin allowPublish (gestor): nunca publica. Su categoria es fija (fixedCategory = su rama; el
//   backend rechaza otra). Editar un borrador o una rechazada la deja en borrador; editar una
//   publicada la devuelve a revision y deja de verse hasta que el admin la apruebe.
// - Municipio obligatorio en todos los tipos y roles (el backend responde 422 MUNICIPALITY_REQUIRED);
//   una publicacion antigua sin municipio obliga a elegirlo al editarla.
// - Eslogan y etiquetas opcionales (hoy solo los muestra el carrusel del inicio); sus errores (422
//   INVALID_TAGLINE / INVALID_TAGS) van en su campo.
// - Fechas con el calendario (DatePicker): mismo formato que el antiguo datetime-local. Solo en
//   EVENTO, "Fecha habitual o tradicion" (hasta 80; 422 INVALID_TRADITION_TEXT en su campo).
// - Solo en EVENTO: "Punto exacto en el mapa" (LocationPicker), obligatorio al crear y al editar (un evento
//   antiguo sin punto no se guarda hasta marcarlo); errores 422 POINT_* en su campo. Mapa vivo (#mapa).
// - Solo en OPORTUNIDAD: tipo (GET /api/opportunity-types; al editar se conserva uno ya desactivado),
//   quien convoca (al crear, el gestor lo trae precargado con su organizacion), dirigida a, premio,
//   requisitos (hasta 8), enlace de postulacion obligatorio y la fecha de cierre (end_date) con el
//   calendario de una sola fecha: sin fecha = convocatoria abierta. Errores por campo (422 de la API).
// - LUGAR (directorio turistico): solo lo ofrecen el admin y el lider (canCreatePlaces; el backend
//   responde 403 a los demas). Categoria de lugar (GET /api/place-categories; al editar se conserva una
//   ya desactivada), direccion o referencia (obligatoria, hasta 160), punto exacto (LocationPicker),
//   telefono, WhatsApp, horario y sitio web opcionales, y categoria cultural opcional: el admin elige
//   cualquiera o ninguna; el lider, ninguna o la suya (fixedCategory). Sin fechas ni enlace generico;
//   resumen y descripcion opcionales. Errores 422 en su campo.
const EMPTY_FORM = {
  kind: 'HISTORIA', title: '', summary: '', content: '', location: 'Caucasia',
  start_date: '', end_date: '', link: '', image: '', cultural_category: '', municipality: '',
  tagline: '', tags: [], tradition_text: '',
  opportunity_type_id: '', organizer: '', audience: '', prize: '', requirements: [], point: null,
  place_category_id: '', phone: '', whatsapp: '', opening_hours: '', website: '',
};
const ADDRESS_MAX = 160;
const PHONE_MAX = 30;
const HOURS_MAX = 200;
const WEBSITE_MAX = 200;
// Codigos 422 de la API -> campo del lugar donde se muestra el error.
const PLACE_ERRORS = {
  PLACE_CATEGORY_REQUIRED: 'category', INVALID_PLACE_CATEGORY: 'category', ADDRESS_REQUIRED: 'address',
  INVALID_ADDRESS: 'address', INVALID_PHONE: 'phone', INVALID_WHATSAPP: 'whatsapp', INVALID_OPENING_HOURS: 'hours',
  INVALID_WEBSITE: 'website',
};
const PLACE_NOTE = 'Si eliges una, el lugar también aparecerá en Explorar en esa rama.';
const POINT_ERRORS = new Set(['POINT_REQUIRED', 'INVALID_POINT', 'POINT_OUT_OF_AREA']);
const DEFAULT_PLACE = 'Caucasia';
const ORGANIZER_MAX = 120;
const AUDIENCE_MAX = 160;
const PRIZE_MAX = 120;
// Codigos 422 de la API -> campo de la oportunidad donde se muestra el error.
const OPPORTUNITY_ERRORS = {
  OPPORTUNITY_TYPE_REQUIRED: 'type', INVALID_OPPORTUNITY_TYPE: 'type', ORGANIZER_REQUIRED: 'organizer',
  INVALID_ORGANIZER: 'organizer', INVALID_REQUIREMENTS: 'requirements', INVALID_PRIZE: 'prize',
  INVALID_AUDIENCE: 'audience', LINK_REQUIRED: 'link', INVALID_LINK: 'link',
};
const HTTP_LINK = /^https?:\/\/[^\s/]+\.[^\s]+$/i;
const TAGLINE_MAX = 100;
const TRADITION_MAX = 80;
const PAST_HINT = {
  EVENTO: 'Esta fecha ya pasó. El evento se mostrará directamente con la etiqueta «Ya pasó».',
  OPORTUNIDAD: 'Esta fecha ya pasó. La oportunidad se mostrará como «Cerrada».',
};
const MUNICIPALITY_MESSAGE = 'Elige el municipio de la publicación.';
// El tipo TALENTO ya no se ofrece al crear: el talento contratable tiene su propio flujo (pestaña
// Talento de los dashboards). Las publicaciones TALENTO que ya existen se siguen editando con su tipo.
// LUGAR solo se ofrece a quien puede crear lugares (admin y lider).
const KINDS = Object.entries(KIND_LABELS);
const kindsFor = (publication, canCreatePlaces) => KINDS.filter(([key]) => (key !== 'TALENTO' || publication?.kind === 'TALENTO')
  && (key !== 'LUGAR' || canCreatePlaces));

const isImageUrl = (value) => /^(https?:\/\/|\/)/.test(value || '');

// El calendario usa "AAAA-MM-DDTHH:mm" (como el antiguo datetime-local); la API devuelve ISO con segundos.
const toLocalInput = (value) => (value ? String(value).slice(0, 16) : '');

function formFromPublication(publication) {
  return {
    kind: publication.kind,
    title: publication.title || '',
    summary: publication.summary || '',
    content: publication.content || '',
    location: publication.location || (publication.kind === 'LUGAR' ? '' : 'Caucasia'),
    start_date: toLocalInput(publication.start_date),
    end_date: toLocalInput(publication.end_date),
    link: publication.link || '',
    // Las publicaciones viejas guardan un degradado CSS en image: no es un enlace, no se muestra.
    image: isImageUrl(publication.image) ? publication.image : '',
    cultural_category: publication.cultural_category || '',
    municipality: publication.municipality || '',
    tagline: publication.tagline || '',
    tags: Array.isArray(publication.tags) ? publication.tags : [],
    tradition_text: publication.tradition_text || '',
    point: publication.latitude != null && publication.longitude != null
      ? { lat: Number(publication.latitude), lng: Number(publication.longitude) } : null,
    opportunity_type_id: publication.opportunity_type?.id ? String(publication.opportunity_type.id) : '',
    organizer: publication.organizer || '',
    audience: publication.audience || '',
    prize: publication.prize || '',
    requirements: Array.isArray(publication.requirements) ? publication.requirements : [],
    place_category_id: publication.place_category?.id ? String(publication.place_category.id) : '',
    phone: publication.phone || '',
    whatsapp: publication.whatsapp ? `+${publication.whatsapp}` : '',
    opening_hours: publication.opening_hours || '',
    website: publication.website || '',
  };
}

// Mismas reglas que backend/service/schemas/publications.py, para avisar antes de enviar.
// En LUGAR, resumen y descripcion son opcionales.
function validate(form) {
  if (form.title.trim().length < 5) return 'El título debe tener al menos 5 caracteres.';
  if (form.kind === 'LUGAR') return '';
  if (form.summary.trim().length < 10) return 'El resumen debe tener al menos 10 caracteres.';
  if (form.content.trim().length < 20) return 'El contenido debe tener al menos 20 caracteres.';
  if (form.start_date && form.end_date && form.end_date < form.start_date) return 'La fecha de fin no puede ser anterior a la de inicio.';
  return '';
}

// Oportunidad: lo obligatorio, campo por campo ({ campo: mensaje }).
function validateOpportunity(form) {
  const errors = {};
  if (!form.opportunity_type_id) errors.type = 'Elige el tipo de oportunidad.';
  if (!form.organizer.trim()) errors.organizer = 'Escribe quién convoca.';
  if (!form.link.trim()) errors.link = 'Agrega el enlace de postulación.';
  else if (!HTTP_LINK.test(form.link.trim())) errors.link = 'El enlace debe ser una dirección web que empiece por http:// o https://';
  return errors;
}

// Lugar: lo obligatorio, campo por campo ({ campo: mensaje }).
function validatePlace(form) {
  const errors = {};
  if (!form.place_category_id) errors.category = 'Elige la categoría del lugar.';
  if (!form.location.trim()) errors.address = 'Escribe la dirección o una referencia para llegar.';
  if (form.website.trim() && !HTTP_LINK.test(form.website.trim())) errors.website = 'El sitio web debe empezar por http:// o https://';
  return errors;
}

// Campo de texto con contador y error accesible (aria-invalid + aria-describedby), como el eslogan.
function CountedField({ id, label, value, onChange, max, error, hint, disabled, placeholder, required, inputMode, autoComplete }) {
  return (
    <div className="grid content-start gap-1.5">
      <label className={FORM_LABEL} htmlFor={id}>{label}</label>
      <input id={id} className={`${FORM_INPUT} ${error ? 'border-[#b3442b]' : ''}`} value={value} onChange={(event) => onChange(event.target.value)}
        maxLength={max} disabled={disabled} placeholder={placeholder} required={required} inputMode={inputMode} autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} />
      <div className="flex justify-between gap-3 text-[13px] text-muted">
        <span id={`${id}-hint`}>{hint}</span>
        <span aria-live="polite" className="shrink-0 tabular-nums">{value.length}/{max}</span>
      </div>
      {error && <p id={`${id}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{error}</p>}
    </div>
  );
}

const CATEGORY_LABELS = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label]) => [key, label]));

// Texto del aviso al guardar, segun quien edita y en que estado queda.
function toastFor({ editing, allowPublish, publish, backToReview, status }) {
  if (!editing) {
    return allowPublish && publish
      ? { tone: 'menta', eyebrow: 'Nuevo hilo', title: 'Publicación creada', text: 'Ya está publicada en TEJIDO.' }
      : { tone: 'menta', eyebrow: 'Nuevo hilo', title: 'Borrador creado', text: 'Revísalo y envíalo cuando esté listo.' };
  }
  if (backToReview) {
    return { tone: 'menta', eyebrow: 'Hilo en camino', title: 'Enviada a revisión', text: 'Dejará de verse hasta que el equipo apruebe los cambios.' };
  }
  if (allowPublish) {
    if (publish) return { tone: 'menta', eyebrow: 'Hilo ajustado', title: 'Publicada con los cambios', text: 'Ya está visible en TEJIDO.' };
    const label = (STATUS_LABELS[status] || [status])[0].toLowerCase();
    return { tone: 'menta', eyebrow: 'Hilo ajustado', title: 'Cambios guardados', text: `Conserva su estado: ${label}.` };
  }
  return { tone: 'menta', eyebrow: 'Hilo ajustado', title: 'Cambios guardados', text: 'Queda como borrador hasta que la envíes.' };
}

export default function PublicationForm({ publication, categories, allowPublish = false, fixedCategory = null, canCreatePlaces = false, onCancel, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => (publication ? formFromPublication(publication) : EMPTY_FORM));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [municipalityError, setMunicipalityError] = useState('');
  const municipalityRef = useRef(null);
  const baseId = useId().replace(/:/g, '');
  const municipalityId = `${baseId}-municipio`;
  const taglineId = `${baseId}-eslogan`;
  const tagsId = `${baseId}-etiquetas`;
  const traditionId = `${baseId}-tradicion`;
  const [traditionError, setTraditionError] = useState('');
  const [taglineError, setTaglineError] = useState('');
  const [tagsError, setTagsError] = useState('');
  const [oppErrors, setOppErrors] = useState({});
  const [types, setTypes] = useState(null);
  const ids = { type: `${baseId}-tipo-oportunidad`, organizer: `${baseId}-convoca`, audience: `${baseId}-dirigida`,
    prize: `${baseId}-premio`, requirements: `${baseId}-requisitos`, link: `${baseId}-enlace` };
  const editing = Boolean(publication);
  const isOpportunity = form.kind === 'OPORTUNIDAD';
  const isEvent = form.kind === 'EVENTO';
  const isPlace = form.kind === 'LUGAR';
  const hasPoint = isEvent || isPlace;
  const pointId = `${baseId}-punto`;
  const [pointError, setPointError] = useState('');
  const placeIds = { category: `${baseId}-categoria-lugar`, address: `${baseId}-direccion`, phone: `${baseId}-telefono`,
    whatsapp: `${baseId}-whatsapp`, hours: `${baseId}-horario`, website: `${baseId}-sitio-web` };
  const culturalId = `${baseId}-categoria-cultural`;
  const [placeErrors, setPlaceErrors] = useState({});
  const [placeCategories, setPlaceCategories] = useState(null);
  const setPlace = (key, errorKey = key) => (value) => { set(key)(value); setPlaceErrors((current) => ({ ...current, [errorKey]: '' })); };
  const placeError = (key) => placeErrors[key] || '';
  // Solo admin: publish: true en el mismo POST/PUT. Una ya publicada sigue publicada al editarla.
  const [publish, setPublish] = useState(false);
  const alreadyPublished = publication?.status === 'PUBLISHED';
  // Gestor editando una publicada: al guardar vuelve a revision.
  const backToReview = editing && !allowPublish && alreadyPublished;
  const outsideBranch = Boolean(fixedCategory && editing && publication.cultural_category !== fixedCategory && publication.kind !== 'LUGAR');
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const field = (key) => ({ value: form[key], onChange: (event) => set(key)(event.target.value), disabled: saving });
  const setOpp = (key, errorKey = key) => (value) => { set(key)(value); setOppErrors((current) => ({ ...current, [errorKey]: '' })); };
  const oppError = (key) => oppErrors[key] || '';

  // Tipos activos, solo cuando hacen falta (OPORTUNIDAD). Al editar una con un tipo ya desactivado,
  // se suma ese tipo para poder conservarlo.
  useEffect(() => {
    if (!isOpportunity || types) return;
    apiRequest('/api/opportunity-types').then(setTypes).catch(() => setTypes([]));
  }, [isOpportunity, types]);
  // Categorias de lugar activas, solo con LUGAR (igual que los tipos: se conserva una ya desactivada).
  useEffect(() => {
    if (!isPlace || placeCategories) return;
    apiRequest('/api/place-categories').then(setPlaceCategories).catch(() => setPlaceCategories([]));
  }, [isPlace, placeCategories]);
  const currentPlaceCategory = publication?.place_category;
  const placeOptions = currentPlaceCategory && placeCategories && !placeCategories.some((item) => item.id === currentPlaceCategory.id)
    ? [...placeCategories, { ...currentPlaceCategory, label: `${currentPlaceCategory.label} (desactivada)` }] : (placeCategories || []);
  const chosenPlaceCategory = placeOptions.find((item) => String(item.id) === form.place_category_id)
    || (currentPlaceCategory && String(currentPlaceCategory.id) === form.place_category_id ? currentPlaceCategory : null);

  // Cambiar a LUGAR deja la direccion vacia (no "Caucasia") y sin categoria cultural asignada; salir de
  // LUGAR devuelve el lugar por defecto.
  function changeKind(event) {
    const kind = event.target.value;
    setForm((current) => {
      const next = { ...current, kind };
      if (kind === 'LUGAR' && current.location.trim() === DEFAULT_PLACE) next.location = '';
      if (kind !== 'LUGAR' && !current.location.trim()) next.location = DEFAULT_PLACE;
      return next;
    });
  }

  const typeOptions = types || [];
  const currentType = publication?.opportunity_type;
  // Mientras cargan los tipos, el actual se muestra tal cual; ya cargados, si no esta entre los activos
  // es porque lo desactivaron.
  const options = currentType && !typeOptions.some((item) => item.id === currentType.id)
    ? [...typeOptions, { ...currentType, label: types ? `${currentType.label} (desactivado)` : currentType.label }] : typeOptions;

  // Al crear, el gestor ve "Quien convoca" precargado con el nombre de su organizacion (lo puede cambiar).
  const prefilled = useRef(false);
  useEffect(() => {
    if (!isOpportunity || editing || allowPublish || prefilled.current) return;
    prefilled.current = true;
    apiRequest('/api/me/organization')
      .then((organization) => {
        const name = organization?.name?.trim();
        if (name) setForm((current) => (current.organizer ? current : { ...current, organizer: name.slice(0, ORGANIZER_MAX) }));
      })
      .catch(() => {});
  }, [isOpportunity, editing, allowPublish]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.municipality) {
      setMunicipalityError(MUNICIPALITY_MESSAGE);
      setError('');
      municipalityRef.current?.focus();
      return;
    }
    const problem = validate(form);
    if (problem) { setError(problem); return; }
    if (isPlace) {
      const errors = validatePlace(form);
      if (Object.keys(errors).length) {
        setPlaceErrors(errors);
        setError('');
        document.getElementById(placeIds[Object.keys(errors)[0]])?.focus();
        return;
      }
    }
    if (hasPoint && !form.point) {
      setPointError(isPlace ? 'Marca el punto exacto del lugar en el mapa.' : 'Marca el punto exacto del evento en el mapa.');
      setError('');
      document.getElementById(`${pointId}-lat`)?.focus();
      return;
    }
    if (isOpportunity) {
      const errors = validateOpportunity(form);
      if (Object.keys(errors).length) {
        setOppErrors(errors);
        setError('');
        document.getElementById(ids[Object.keys(errors)[0]])?.focus();
        return;
      }
    }
    const category = categories.find((item) => item.type === form.kind);
    if (!category) { setError('No encontramos una categoría para ese tipo de publicación.'); return; }
    const payload = {
      kind: form.kind,
      category_id: category.id,
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      location: isPlace ? form.location.trim() : form.location.trim() || 'Caucasia',
      start_date: isPlace ? null : form.start_date || null,
      end_date: isPlace ? null : form.end_date || null,
      link: isPlace ? null : form.link.trim() || null,
      // Si no hay enlace nuevo se conserva un degradado viejo (no se muestra en el formulario).
      image: form.image.trim() || (editing && publication.image && !isImageUrl(publication.image) ? publication.image : null),
      cultural_category: (isPlace ? form.cultural_category : fixedCategory || form.cultural_category) || null,
      municipality: form.municipality,
      tagline: form.tagline.trim() || null,
      tags: form.tags,
      tradition_text: form.kind === 'EVENTO' ? form.tradition_text.trim() || null : null,
      ...(hasPoint && form.point ? { latitude: form.point.lat, longitude: form.point.lng } : {}),
      ...(isPlace ? {
        place_category_id: Number(form.place_category_id),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        opening_hours: form.opening_hours.trim() || null,
        website: form.website.trim() || null,
      } : {}),
      ...(isOpportunity ? {
        opportunity_type_id: Number(form.opportunity_type_id),
        organizer: form.organizer.trim(),
        audience: form.audience.trim() || null,
        prize: form.prize.trim() || null,
        requirements: form.requirements,
      } : {}),
      ...(allowPublish && publish ? { publish: true } : {}),
    };
    setSaving(true);
    setError('');
    try {
      if (editing) await apiRequest(`/api/publications/${publication.id}`, { method: 'PUT', body: payload });
      else await apiRequest('/api/publications', { method: 'POST', body: payload });
      showToast(toastFor({ editing, allowPublish, publish, backToReview, status: publication?.status }));
      onSaved();
    } catch (saveError) {
      // El foco va al campo cuando ya no esta deshabilitado (despues de setSaving(false)).
      const focusLater = (element) => requestAnimationFrame(() => element?.focus());
      if (saveError.code === 'MUNICIPALITY_REQUIRED') {
        setMunicipalityError(saveError.message);
        focusLater(municipalityRef.current);
      } else if (saveError.code === 'INVALID_TAGLINE') {
        setTaglineError(saveError.message);
        focusLater(document.getElementById(taglineId));
      } else if (saveError.code === 'INVALID_TRADITION_TEXT') {
        setTraditionError(saveError.message);
        focusLater(document.getElementById(traditionId));
      } else if (PLACE_ERRORS[saveError.code] && isPlace) {
        const key = PLACE_ERRORS[saveError.code];
        setPlaceErrors((current) => ({ ...current, [key]: saveError.message }));
        focusLater(document.getElementById(placeIds[key]));
      } else if (POINT_ERRORS.has(saveError.code) && hasPoint) {
        setPointError(saveError.message);
        focusLater(document.getElementById(`${pointId}-lat`));
      } else if (OPPORTUNITY_ERRORS[saveError.code] && isOpportunity) {
        const key = OPPORTUNITY_ERRORS[saveError.code];
        setOppErrors((current) => ({ ...current, [key]: saveError.message }));
        focusLater(document.getElementById(ids[key]));
      } else if (saveError.code === 'INVALID_TAGS') {
        setTagsError(saveError.message);
        focusLater(document.getElementById(tagsId));
      } else {
        setError(saveError.message);
      }
      setSaving(false);
    }
  }

  return (
    <section className={PANEL} aria-labelledby="formulario-publicacion">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="formulario-publicacion" className={PANEL_TITLE}>{isPlace ? (editing ? 'Editar lugar' : 'Nuevo lugar') : editing ? 'Editar publicación' : 'Nueva publicación'}</h2>
        <button type="button" className={BTN_GHOST} onClick={onCancel} disabled={saving}><Icon name="close" className="size-4" /> Cerrar</button>
      </div>
      {backToReview && (
        <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(212,168,67,0.16)] py-3 px-4 text-[14px] leading-[1.5] text-[#6b4f0e]" role="note">
          <strong>Está publicada.</strong> Al guardar, volverá a revisión y dejará de verse hasta que el equipo la apruebe.
        </p>
      )}
      {publication?.status === 'REJECTED' && publication.moderation_note && (
        <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Qué ajustar:</strong> {publication.moderation_note}</p>
      )}
      <form className="mt-6 grid gap-5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-5 max600:grid-cols-1">
          <label className={FORM_LABEL}>Tipo
            <select className={FORM_INPUT} value={form.kind} onChange={changeKind} disabled={saving}>
              {kindsFor(publication, canCreatePlaces).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          {isPlace ? (
            <div className="grid content-start gap-1.5">
              <label className={FORM_LABEL} htmlFor={culturalId}>Categoría cultural (opcional)</label>
              <select id={culturalId} className={FORM_INPUT} {...field('cultural_category')} aria-describedby={`${culturalId}-hint`}>
                <option value="">Sin categoría cultural</option>
                {(fixedCategory ? CULTURAL_CATEGORIES.filter(([key]) => key === fixedCategory) : CULTURAL_CATEGORIES)
                  .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <span id={`${culturalId}-hint`} className="text-[13px] text-muted">{PLACE_NOTE}</span>
            </div>
          ) : fixedCategory ? (
            <label className={FORM_LABEL}>Categoría cultural
              <input className={FORM_INPUT} value={CATEGORY_LABELS[fixedCategory] || fixedCategory} disabled readOnly />
              <span className="text-[12px] font-medium normal-case tracking-normal text-muted">
                {outsideBranch
                  ? `Publicas en tu categoría. Esta era de «${CATEGORY_LABELS[publication.cultural_category] || 'sin categoría'}»: al guardar pasa a la tuya.`
                  : 'Publicas en tu categoría.'}
              </span>
            </label>
          ) : (
            <label className={FORM_LABEL}>Categoría cultural
              <select className={FORM_INPUT} {...field('cultural_category')}>
                <option value="">Sin categoría</option>
                {CULTURAL_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          )}
        </div>
        <label className={FORM_LABEL}>Título
          <input className={FORM_INPUT} {...field('title')} maxLength={180} required />
        </label>
        <div className="grid content-start gap-1.5">
          <label className={FORM_LABEL} htmlFor={taglineId}>Eslogan (opcional)</label>
          <input
            id={taglineId}
            className={`${FORM_INPUT} ${taglineError ? 'border-[#b3442b]' : ''}`}
            value={form.tagline}
            onChange={(event) => { set('tagline')(event.target.value); setTaglineError(''); }}
            maxLength={TAGLINE_MAX}
            disabled={saving}
            aria-invalid={taglineError ? true : undefined}
            aria-describedby={`${taglineId}-hint${taglineError ? ` ${taglineId}-error` : ''}`}
          />
          <div className="flex justify-between gap-3 text-[13px] text-muted">
            <span id={`${taglineId}-hint`}>Una frase breve que acompaña el título.</span>
            <span aria-live="polite" className="shrink-0 tabular-nums">{form.tagline.length}/{TAGLINE_MAX}</span>
          </div>
          {taglineError && <p id={`${taglineId}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{taglineError}</p>}
        </div>
        <label className={FORM_LABEL}>{isPlace ? 'Resumen (opcional)' : 'Resumen'}
          <input className={FORM_INPUT} {...field('summary')} maxLength={500} required={!isPlace} />
        </label>
        <label className={FORM_LABEL}>{isPlace ? 'Descripción (opcional)' : 'Contenido'}
          <textarea className={`${FORM_INPUT} ${isPlace ? 'min-h-[120px]' : 'min-h-[180px]'} resize-y leading-[1.55]`} {...field('content')} maxLength={20000} required={!isPlace} />
        </label>
        <TagsInput
          id={tagsId}
          label="Etiquetas (opcional, hasta 3)"
          hint="Enter o coma para agregar; hasta 24 caracteres cada una."
          value={form.tags}
          onChange={set('tags')}
          disabled={saving}
          error={tagsError}
          onError={setTagsError}
        />
        {isPlace && (
          <fieldset className="m-0 grid gap-5 rounded-[18px] border border-[#e2d9ca] bg-white/50 p-5 max600:p-4" data-campos-lugar>
            <legend className="px-1 text-[13px] font-extrabold uppercase tracking-[.12em] text-ink">Datos del lugar</legend>
            <div className="grid content-start gap-1.5">
              <label className={FORM_LABEL} htmlFor={placeIds.category}>Categoría de lugar</label>
              <div className="flex items-center gap-3">
                {chosenPlaceCategory && (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border-2" aria-hidden="true" data-muestra-categoria
                    style={{ backgroundColor: placeColors(chosenPlaceCategory.color).bg, color: placeColors(chosenPlaceCategory.color).text,
                      borderColor: '#173f36' }}>
                    <PlaceIcon icon={chosenPlaceCategory.icon} className="size-6" />
                  </span>
                )}
                <select id={placeIds.category} className={`${FORM_INPUT} ${placeError('category') ? 'border-[#b3442b]' : ''}`} value={form.place_category_id}
                  onChange={(event) => setPlace('place_category_id', 'category')(event.target.value)} disabled={saving} required
                  aria-invalid={placeError('category') ? true : undefined} aria-describedby={placeError('category') ? `${placeIds.category}-error` : undefined}>
                  <option value="">{placeCategories ? 'Elige la categoría' : 'Cargando categorías...'}</option>
                  {placeOptions.map((item) => <option key={item.id} value={String(item.id)}>{item.label}</option>)}
                </select>
              </div>
              {placeError('category') && <p id={`${placeIds.category}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{placeError('category')}</p>}
            </div>
            <div className="grid grid-cols-2 gap-5 max600:grid-cols-1">
              <CountedField id={placeIds.phone} label="Teléfono (opcional)" value={form.phone} onChange={setPlace('phone')} max={PHONE_MAX}
                error={placeError('phone')} disabled={saving} inputMode="tel" autoComplete="off" hint="Números y los signos + - ( ). P. ej. 604 839 1234." />
              <CountedField id={placeIds.whatsapp} label="WhatsApp (opcional)" value={form.whatsapp} onChange={setPlace('whatsapp')} max={PHONE_MAX}
                error={placeError('whatsapp')} disabled={saving} inputMode="tel" autoComplete="off" hint="Celular de 10 dígitos o con indicativo (+57 300 123 4567)." />
            </div>
            <CountedField id={placeIds.hours} label="Horario (opcional)" value={form.opening_hours} onChange={setPlace('opening_hours', 'hours')} max={HOURS_MAX}
              error={placeError('hours')} disabled={saving} hint="P. ej. «Lunes a sábado, 8 a. m. a 6 p. m.»." />
            <CountedField id={placeIds.website} label="Sitio web (opcional)" value={form.website} onChange={setPlace('website')} max={WEBSITE_MAX}
              error={placeError('website')} disabled={saving} inputMode="url" placeholder="https://..." hint="Empieza por https:// o http://." />
          </fieldset>
        )}
        {isOpportunity && (
          <fieldset className="m-0 grid gap-5 rounded-[18px] border border-[#e2d9ca] bg-white/50 p-5 max600:p-4" data-campos-oportunidad>
            <legend className="px-1 text-[13px] font-extrabold uppercase tracking-[.12em] text-ink">Datos de la oportunidad</legend>
            <div className="grid content-start gap-1.5">
              <label className={FORM_LABEL} htmlFor={ids.type}>Tipo de oportunidad</label>
              <select id={ids.type} className={`${FORM_INPUT} ${oppError('type') ? 'border-[#b3442b]' : ''}`} value={form.opportunity_type_id}
                onChange={(event) => setOpp('opportunity_type_id', 'type')(event.target.value)} disabled={saving} required
                aria-invalid={oppError('type') ? true : undefined} aria-describedby={oppError('type') ? `${ids.type}-error` : undefined}>
                <option value="">{types ? 'Elige el tipo' : 'Cargando tipos...'}</option>
                {options.map((item) => <option key={item.id} value={String(item.id)}>{item.label}</option>)}
              </select>
              {oppError('type') && <p id={`${ids.type}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{oppError('type')}</p>}
            </div>
            <CountedField id={ids.organizer} label="Quién convoca" value={form.organizer} onChange={setOpp('organizer')} max={ORGANIZER_MAX}
              error={oppError('organizer')} disabled={saving} hint="La entidad, colectivo o persona que abre la convocatoria." />
            <div className="grid grid-cols-2 gap-5 max600:grid-cols-1">
              <CountedField id={ids.audience} label="Dirigida a (opcional)" value={form.audience} onChange={setOpp('audience')} max={AUDIENCE_MAX}
                error={oppError('audience')} disabled={saving} hint="P. ej. «Jóvenes de 14 a 28 años del Bajo Cauca»." />
              <CountedField id={ids.prize} label="Premio o monto (opcional)" value={form.prize} onChange={setOpp('prize')} max={PRIZE_MAX}
                error={oppError('prize')} disabled={saving} hint="P. ej. «$3.000.000» o «Beca de formación»." />
            </div>
            <RequirementsInput
              id={ids.requirements}
              label="Requisitos (opcional, hasta 8)"
              hint="Enter o «Agregar» para sumar cada requisito; hasta 160 caracteres."
              value={form.requirements}
              onChange={setOpp('requirements')}
              disabled={saving}
              error={oppError('requirements')}
              onError={(message) => setOppErrors((current) => ({ ...current, requirements: message }))}
            />
          </fieldset>
        )}
        <div className="grid grid-cols-2 gap-5 max600:grid-cols-1">
          <div className="grid content-start gap-1.5">
            <label className={FORM_LABEL} htmlFor={municipalityId}>Municipio</label>
            <select
              id={municipalityId}
              ref={municipalityRef}
              className={FORM_INPUT}
              value={form.municipality}
              onChange={(event) => { set('municipality')(event.target.value); setMunicipalityError(''); }}
              disabled={saving}
              required
              aria-invalid={municipalityError ? true : undefined}
              aria-describedby={municipalityError ? `${municipalityId}-error` : undefined}
            >
              <option value="">Elige el municipio</option>
              {MUNICIPALITIES.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
            {municipalityError && <p id={`${municipalityId}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{municipalityError}</p>}
          </div>
          {isPlace ? (
            <CountedField id={placeIds.address} label="Dirección o referencia" value={form.location} onChange={setPlace('location', 'address')}
              max={ADDRESS_MAX} error={placeError('address')} disabled={saving} required hint="Calle y número, o cómo llegar: «Frente al parque principal»." />
          ) : (
            <label className={FORM_LABEL}>Lugar (nombre o referencia)
              <input className={FORM_INPUT} {...field('location')} maxLength={180} />
            </label>
          )}
        </div>
        {hasPoint && (
          <LocationPicker
            id={pointId}
            label={isPlace ? 'Punto exacto del lugar en el mapa' : undefined}
            value={form.point}
            onChange={(point) => { set('point')(point); setPointError(''); }}
            municipality={form.municipality}
            error={pointError}
            disabled={saving}
            placeEmpty={!form.location.trim() || form.location.trim() === DEFAULT_PLACE}
            onUsePlace={isPlace ? setPlace('location', 'address') : set('location')}
            placeNoun={isPlace ? 'dirección' : 'lugar'}
          />
        )}
        {isPlace ? null : isOpportunity ? (
          <DatePicker
            single
            label="Fecha de cierre (opcional)"
            hint="Sin fecha de cierre, queda como convocatoria abierta. La hora es opcional."
            start={form.end_date}
            onChange={({ start }) => setForm((current) => ({ ...current, end_date: start }))}
            disabled={saving}
            pastHint={PAST_HINT.OPORTUNIDAD}
          />
        ) : (
          <DatePicker
            label="Fechas (opcional)"
            hint="Elige el día de inicio y, si dura varios días, el de fin. La hora es opcional."
            start={form.start_date}
            end={form.end_date}
            onChange={({ start, end }) => setForm((current) => ({ ...current, start_date: start, end_date: end }))}
            disabled={saving}
            pastHint={PAST_HINT[form.kind] || 'Esta fecha ya pasó.'}
          />
        )}
        {form.kind === 'EVENTO' && (
          <div className="grid content-start gap-1.5">
            <label className={FORM_LABEL} htmlFor={traditionId}>Fecha habitual o tradición (opcional)</label>
            <input
              id={traditionId}
              className={`${FORM_INPUT} ${traditionError ? 'border-[#b3442b]' : ''}`}
              value={form.tradition_text}
              onChange={(event) => { set('tradition_text')(event.target.value); setTraditionError(''); }}
              maxLength={TRADITION_MAX}
              disabled={saving}
              placeholder="Cada 20 de julio"
              aria-invalid={traditionError ? true : undefined}
              aria-describedby={`${traditionId}-hint${traditionError ? ` ${traditionId}-error` : ''}`}
            />
            <div className="flex justify-between gap-3 text-[13px] text-muted">
              <span id={`${traditionId}-hint`}>Para eventos que se repiten cada año, p. ej. «Cada 20 de julio». Sin una fecha próxima, el evento se muestra en Tradiciones de la Agenda.</span>
              <span aria-live="polite" className="shrink-0 tabular-nums">{form.tradition_text.length}/{TRADITION_MAX}</span>
            </div>
            {traditionError && <p id={`${traditionId}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{traditionError}</p>}
          </div>
        )}
        {isPlace ? null : isOpportunity ? (
          <div className="grid content-start gap-1.5">
            <label className={FORM_LABEL} htmlFor={ids.link}>Enlace de postulación</label>
            <input id={ids.link} className={`${FORM_INPUT} ${oppError('link') ? 'border-[#b3442b]' : ''}`} type="text" inputMode="url"
              placeholder="https://..." value={form.link} onChange={(event) => setOpp('link')(event.target.value)} disabled={saving} required
              aria-invalid={oppError('link') ? true : undefined} aria-describedby={`${ids.link}-hint${oppError('link') ? ` ${ids.link}-error` : ''}`} />
            <span id={`${ids.link}-hint`} className="text-[13px] text-muted">Adonde va la persona al pulsar «Postularme».</span>
            {oppError('link') && <p id={`${ids.link}-error`} className="m-0 text-[13px] font-semibold text-[#b3442b]">{oppError('link')}</p>}
          </div>
        ) : (
          <label className={FORM_LABEL}>Enlace (opcional)
            <input className={FORM_INPUT} type="text" inputMode="url" placeholder="https://..." {...field('link')} />
          </label>
        )}
        <ImageField label="Imagen (opcional)" value={form.image} onChange={set('image')} scope="publication" disabled={saving} hint={isPlace ? 'Sin imagen, se muestra el ícono de su categoría de lugar.' : 'Sin imagen, la tarjeta usa el color del tipo.'} />
        {allowPublish && !(editing && alreadyPublished) && (
          <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[#d9cfbe] bg-white py-3 px-4">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--ink)]" checked={publish} onChange={(event) => setPublish(event.target.checked)} disabled={saving} />
            <span className="text-[14px] leading-[1.45] text-ink">
              <strong className="block">{editing ? 'Publicar al guardar' : 'Publicar directamente'}</strong>
              <span className="text-muted">{editing ? `Sin marcar, conserva su estado actual (${(STATUS_LABELS[publication.status] || [publication.status])[0].toLowerCase()}).` : 'Sin marcar, se crea como borrador.'}</span>
            </span>
          </label>
        )}
        {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BTN_INK_MD} disabled={saving}>{saving ? 'Guardando...' : editing ? (backToReview ? 'Guardar y enviar a revisión' : allowPublish && publish ? 'Guardar y publicar' : 'Guardar cambios') : allowPublish && publish ? 'Crear y publicar' : 'Crear borrador'}</button>
          <button type="button" className={BTN_INK_OUTLINE_MD} onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </form>
    </section>
  );
}

