import { useState } from 'react';
import Icon from './Icon.jsx';
import ImageUrlField from './ImageUrlField.jsx';
import { BTN_GHOST, FORM_INPUT, FORM_LABEL, LINK_BTN, LINK_BTN_SOLID, PANEL, PANEL_TITLE } from './uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { CULTURAL_CATEGORIES, KIND_LABELS } from '../utils/constants.js';

// Formulario de crear/editar publicacion, compartido por el Dashboard del Gestor y el del
// Admin. POST /api/publications (crear) o PUT /api/publications/{id} (editar).
// - category_id no se pregunta: es la categoria de GET /api/categories cuyo type es el kind.
// - allowPublish (admin): casilla para publicar sin pasar por revision. Al crear manda
//   publish: true (el backend solo lo respeta si es ADMIN). Al editar, el backend deja la
//   publicacion en borrador, asi que la vuelve a publicar con submit + aprobar.
// - Sin allowPublish (gestor): nunca publica; todo queda en borrador hasta enviarlo.
const EMPTY_FORM = {
  kind: 'HISTORIA', title: '', summary: '', content: '', location: 'Caucasia',
  start_date: '', end_date: '', link: '', image: '', cultural_category: '',
};
const KINDS = Object.entries(KIND_LABELS);

const isImageUrl = (value) => /^(https?:\/\/|\/)/.test(value || '');

// datetime-local quiere "AAAA-MM-DDTHH:mm"; la API devuelve ISO con segundos.
const toLocalInput = (value) => (value ? String(value).slice(0, 16) : '');

function formFromPublication(publication) {
  return {
    kind: publication.kind,
    title: publication.title || '',
    summary: publication.summary || '',
    content: publication.content || '',
    location: publication.location || 'Caucasia',
    start_date: toLocalInput(publication.start_date),
    end_date: toLocalInput(publication.end_date),
    link: publication.link || '',
    // Las publicaciones viejas guardan un degradado CSS en image: no es un enlace, no se muestra.
    image: isImageUrl(publication.image) ? publication.image : '',
    cultural_category: publication.cultural_category || '',
  };
}

// Mismas reglas que backend/service/schemas/publications.py, para avisar antes de enviar.
function validate(form) {
  if (form.title.trim().length < 5) return 'El título debe tener al menos 5 caracteres.';
  if (form.summary.trim().length < 10) return 'El resumen debe tener al menos 10 caracteres.';
  if (form.content.trim().length < 20) return 'El contenido debe tener al menos 20 caracteres.';
  if (form.start_date && form.end_date && form.end_date < form.start_date) return 'La fecha de fin no puede ser anterior a la de inicio.';
  return '';
}

export default function PublicationForm({ publication, categories, allowPublish = false, onCancel, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => (publication ? formFromPublication(publication) : EMPTY_FORM));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(publication);
  // Solo admin: al crear manda publish: true; al editar, como el backend deja todo PUT en
  // borrador, vuelve a publicarla (submit + aprobar). Marcado si ya estaba publicada.
  const [publish, setPublish] = useState(() => Boolean(allowPublish && publication?.status === 'PUBLISHED'));
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const field = (key) => ({ value: form[key], onChange: (event) => set(key)(event.target.value), disabled: saving });

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validate(form);
    if (problem) { setError(problem); return; }
    const category = categories.find((item) => item.type === form.kind);
    if (!category) { setError('No encontramos una categoría para ese tipo de publicación.'); return; }
    const payload = {
      kind: form.kind,
      category_id: category.id,
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      location: form.location.trim() || 'Caucasia',
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      link: form.link.trim() || null,
      // Si no hay enlace nuevo se conserva un degradado viejo (no se muestra en el formulario).
      image: form.image.trim() || (editing && publication.image && !isImageUrl(publication.image) ? publication.image : null),
      cultural_category: form.cultural_category || null,
      ...(allowPublish && !editing && publish ? { publish: true } : {}),
    };
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await apiRequest(`/api/publications/${publication.id}`, { method: 'PUT', body: payload });
        if (allowPublish && publish) {
          await apiRequest(`/api/publications/${publication.id}/submit`, { method: 'POST' });
          await apiRequest(`/api/publications/${publication.id}/status`, { method: 'PATCH', body: { status: 'PUBLISHED', note: '' } });
        }
      } else {
        await apiRequest('/api/publications', { method: 'POST', body: payload });
      }
      const published = allowPublish && publish;
      showToast(editing
        ? { tone: 'menta', eyebrow: 'Hilo ajustado', title: 'Cambios guardados', text: published ? 'Sigue publicada con los cambios.' : 'Queda como borrador hasta que la envíes.' }
        : published
          ? { tone: 'menta', eyebrow: 'Nuevo hilo', title: 'Publicación creada', text: 'Ya está publicada en TEJIDO.' }
          : { tone: 'menta', eyebrow: 'Nuevo hilo', title: 'Borrador creado', text: 'Revísalo y envíalo cuando esté listo.' });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <section className={PANEL} aria-labelledby="formulario-publicacion">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="formulario-publicacion" className={PANEL_TITLE}>{editing ? 'Editar publicación' : 'Nueva publicación'}</h2>
        <button type="button" className={BTN_GHOST} onClick={onCancel} disabled={saving}><Icon name="close" className="size-4" /> Cerrar</button>
      </div>
      {publication?.status === 'REJECTED' && publication.moderation_note && (
        <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] leading-[1.5] text-[#a8431f]"><strong>Qué ajustar:</strong> {publication.moderation_note}</p>
      )}
      <form className="mt-6 grid gap-5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-5 max600:grid-cols-1">
          <label className={FORM_LABEL}>Tipo
            <select className={FORM_INPUT} {...field('kind')}>
              {KINDS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className={FORM_LABEL}>Categoría cultural
            <select className={FORM_INPUT} {...field('cultural_category')}>
              <option value="">Sin categoría</option>
              {CULTURAL_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        <label className={FORM_LABEL}>Título
          <input className={FORM_INPUT} {...field('title')} maxLength={180} required />
        </label>
        <label className={FORM_LABEL}>Resumen
          <input className={FORM_INPUT} {...field('summary')} maxLength={500} required />
        </label>
        <label className={FORM_LABEL}>Contenido
          <textarea className={`${FORM_INPUT} min-h-[180px] resize-y leading-[1.55]`} {...field('content')} maxLength={20000} required />
        </label>
        <div className="grid grid-cols-3 gap-5 max800:grid-cols-1">
          <label className={FORM_LABEL}>Ubicación
            <input className={FORM_INPUT} {...field('location')} maxLength={180} />
          </label>
          <label className={FORM_LABEL}>Inicio (opcional)
            <input className={FORM_INPUT} type="datetime-local" {...field('start_date')} />
          </label>
          <label className={FORM_LABEL}>Fin (opcional)
            <input className={FORM_INPUT} type="datetime-local" {...field('end_date')} />
          </label>
        </div>
        <label className={FORM_LABEL}>Enlace (opcional)
          <input className={FORM_INPUT} type="text" inputMode="url" placeholder="https://..." {...field('link')} />
        </label>
        <ImageUrlField label="Imagen (enlace, opcional)" value={form.image} onChange={set('image')} disabled={saving} hint="Pega el enlace de una imagen; sin imagen la tarjeta usa el color del tipo." />
        {allowPublish && (
          <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[#d9cfbe] bg-white py-3 px-4">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--ink)]" checked={publish} onChange={(event) => setPublish(event.target.checked)} disabled={saving} />
            <span className="text-[14px] leading-[1.45] text-ink">
              <strong className="block">{editing ? 'Publicar al guardar' : 'Publicar directamente'}</strong>
              <span className="text-muted">{editing ? 'Sin marcar, la publicación queda como borrador después de editarla.' : 'Sin marcar, se crea como borrador.'}</span>
            </span>
          </label>
        )}
        {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={LINK_BTN_SOLID} disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : allowPublish && publish ? 'Crear y publicar' : 'Crear borrador'}</button>
          <button type="button" className={LINK_BTN} onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </form>
    </section>
  );
}

