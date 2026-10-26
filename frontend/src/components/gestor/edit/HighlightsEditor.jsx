import { useEffect, useRef, useState } from 'react';
import Icon from '../../Icon.jsx';
import { BTN_DANGER, BTN_GHOST, BTN_INK_MD, BTN_INK_SM } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { apiRequest } from '../../../utils/api.js';
import MultiImageField from './MultiImageField.jsx';
import { ConfirmDialog, EditorShell, HINT, LIMITS, TextField, isBlank } from './common.jsx';
import useEditorForm from './useEditorForm.js';

// "Lo que hacemos": lista de manifestaciones culturales. Cada una se agrega, edita o elimina por
// separado (POST / PATCH / DELETE /api/me/profile/highlights) y se publica al guardarla; la lista
// se cierra con "Listo". Maximo 8 manifestaciones y 4 fotos cada una (como el backend).
const orNull = (value) => (isBlank(value) ? null : String(value).trim());

function HighlightForm({ highlight, onSaved, onCancel, onDirtyChange }) {
  const form = useEditorForm({
    title: highlight?.title || '', when_text: highlight?.when_text || '', description: highlight?.description || '',
    images: (highlight?.images || []).map(({ url, alt_text }) => ({ url, alt_text: alt_text || '', caption: '' })),
  }, { onDirtyChange, onSaved });
  const { values, set } = form;
  const [busy, setBusy] = useState(false);

  function submit() {
    if (isBlank(values.title)) { form.setError('El título es requerido.'); return; }
    const body = {
      title: values.title.trim(), when_text: orNull(values.when_text), description: orNull(values.description),
      images: values.images.map((image) => ({ url: image.url, alt_text: orNull(image.alt_text) })),
    };
    form.save(() => (highlight
      ? apiRequest(`/api/me/profile/highlights/${highlight.id}`, { method: 'PATCH', body })
      : apiRequest('/api/me/profile/highlights', { method: 'POST', body })));
  }

  return (
    <EditorShell title={highlight ? 'Editar manifestación' : 'Nueva manifestación cultural'} onSubmit={submit} onCancel={onCancel}
      saving={form.saving} error={form.error} busyText={busy ? 'Esperando las subidas...' : ''}>
      <TextField label="Título" value={values.title} onChange={set('title')} max={LIMITS.highlightTitle} counter inputProps={{ required: true }} />
      <TextField label="Cuándo" value={values.when_text} onChange={set('when_text')} max={LIMITS.highlightWhen} hint="Ejemplo: “Cada diciembre” o “Marzo 2026”." />
      <TextField label="Descripción" multiline rows={5} value={values.description} onChange={set('description')} max={LIMITS.highlightDescription} counter />
      <MultiImageField label="Fotos" value={values.images} onChange={set('images')} max={LIMITS.highlightImages} onBusyChange={setBusy} />
    </EditorShell>
  );
}

export default function HighlightsEditor({ profile, onChanged, onClose, onDirtyChange }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | highlight
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const highlights = profile.highlights;
  const full = highlights.length >= LIMITS.highlights;

  // En modo lista el foco va al primer boton (agregar o editar la primera).
  useEffect(() => {
    if (!editing) listRef.current?.querySelector('button')?.focus();
  }, [editing]);

  async function remove(highlight) {
    setDeleting(null);
    setError('');
    try {
      await apiRequest(`/api/me/profile/highlights/${highlight.id}`, { method: 'DELETE' });
      showToast({ tone: 'menta', eyebrow: 'Hilo actualizado', title: 'Manifestación eliminada' });
      onChanged();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  if (editing) {
    return (
      <HighlightForm
        highlight={editing === 'new' ? null : editing}
        onDirtyChange={onDirtyChange}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged(); }}
      />
    );
  }

  return (
    <div ref={listRef} className="grid gap-4 rounded-[24px] border-2 border-ink/80 bg-white p-6 max600:p-4"
      onKeyDown={(event) => { if (event.key === 'Escape' && !deleting) { event.preventDefault(); onClose(); } }}>
      <h3 className="m-0 font-sans text-[20px] font-extrabold tracking-[-0.02em] text-ink">Lo que hacemos</h3>
      <p className={HINT}>Cada manifestación se publica al guardarla. Hasta {LIMITS.highlights}.</p>
      <div>
        <button type="button" className={`${BTN_INK_SM} max480:w-full`} disabled={full} onClick={() => setEditing('new')}>
          <Icon name="pen" className="size-3.5" /> {full ? `Llegaste al máximo de ${LIMITS.highlights} manifestaciones` : 'Agregar manifestación'}
        </button>
      </div>
      {highlights.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-paper py-3 px-4">
              <span className="min-w-0 flex-1 basis-[200px]">
                <strong className="block text-[16px] text-ink [overflow-wrap:anywhere]">{highlight.title}</strong>
                <span className="text-[13px] text-[#53645c]">
                  {[highlight.when_text, `${highlight.images.length} ${highlight.images.length === 1 ? 'foto' : 'fotos'}`].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex flex-wrap gap-2 max480:w-full">
                <button type="button" className={BTN_GHOST} onClick={() => setEditing(highlight)} aria-label={`Editar ${highlight.title}`}>Editar</button>
                <button type="button" className={BTN_DANGER} onClick={() => setDeleting(highlight)} aria-label={`Eliminar ${highlight.title}`}>Eliminar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
      <div><button type="button" className={`${BTN_INK_MD} max480:w-full`} onClick={onClose}>Listo</button></div>
      {deleting && (
        <ConfirmDialog title="¿Eliminar esta manifestación?" text={`“${deleting.title}” y sus fotos dejarán de verse en tu perfil. No se puede deshacer.`}
          confirmLabel="Sí, eliminar" danger onConfirm={() => remove(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  );
}
