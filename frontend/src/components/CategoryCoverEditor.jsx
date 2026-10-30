import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { ConfirmDialog } from './gestor/edit/common.jsx';
import { BTN_GHOST, BTN_INK_SM } from './uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { apiRequest } from '../utils/api.js';
import { coverSources, setCategoryCovers, useCategoryCovers } from '../utils/categoryCovers.js';
import { CULTURAL_CATEGORIES } from '../utils/constants.js';
import { ACCEPTED_IMAGE_TYPES, uploadImage, validateImageFile } from '../utils/uploadImage.js';

// Portada de UNA categoria cultural (la de Explorar / CategoryCoversGrid), para el admin (las 10) y
// el lider (la de su rama). Muestra la portada efectiva (la guardada o, sin ella, la estatica),
// "Cambiar imagen" (subida firmada a Cloudinary, scope "category_cover", mismas validaciones de tipo
// y peso que el resto del sitio; al terminar se guarda con PUT /api/cultural-categories/{clave}/cover)
// y "Volver a la original" (DELETE, con confirmacion). El backend decide quien puede. Tras cada
// cambio, setCategoryCovers actualiza todas las portadas montadas sin recargar.
const CATEGORY = Object.fromEntries(CULTURAL_CATEGORIES.map(([key, label, slug]) => [key, { label, slug }]));

function CoverPreview({ sources, label }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [sources.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const src = sources[index];
  return (
    <div className="aspect-[16/10] overflow-hidden rounded-[16px] bg-cream">
      {src && <img src={src} alt={`Portada de ${label}`} className="size-full object-cover" onError={() => setIndex((current) => current + 1)} />}
    </div>
  );
}

export default function CategoryCoverEditor({ categoryKey, headingLevel = 3 }) {
  const { showToast } = useToast();
  const covers = useCategoryCovers();
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const hintId = useId();
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState({ error: false, text: '' });
  const { label, slug } = CATEGORY[categoryKey];
  const custom = Boolean(covers?.[categoryKey]);
  const Heading = `h${headingLevel}`;

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleFile(file) {
    if (!file || busy) return;
    setMessage({ error: false, text: '' });
    try {
      validateImageFile(file);
    } catch (error) {
      setMessage({ error: true, text: error.message });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(0);
    try {
      const url = await uploadImage(file, 'category_cover', undefined, { signal: controller.signal, onProgress: setProgress });
      setProgress(null);
      const map = await apiRequest(`/api/cultural-categories/${categoryKey}/cover`, { method: 'PUT', body: { image_url: url } });
      setCategoryCovers(map);
      setMessage({ error: false, text: 'Portada actualizada.' });
      showToast({ tone: 'menta', eyebrow: 'Portada nueva', title: `${label} ya luce su nueva portada`, text: 'Se ve en Explorar y en la página de la categoría.' });
    } catch (error) {
      if (error.name !== 'AbortError') setMessage({ error: true, text: error.message });
    } finally {
      abortRef.current = null;
      setProgress(null);
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function restore() {
    setConfirming(false);
    setBusy(true);
    setMessage({ error: false, text: '' });
    try {
      const map = await apiRequest(`/api/cultural-categories/${categoryKey}/cover`, { method: 'DELETE' });
      setCategoryCovers(map);
      setMessage({ error: false, text: 'Volvió la portada original.' });
      showToast({ tone: 'menta', title: `${label}: portada original`, text: 'Se restableció la imagen de siempre.' });
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="grid content-start gap-3 rounded-[20px] border border-[#e2d9ca] bg-[#fffaf2] p-4" aria-busy={busy}>
      <CoverPreview sources={coverSources(covers, categoryKey, slug, { width: 640 })} label={label} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading className="m-0 font-sans text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{label}</Heading>
        <span className={`rounded-full py-0.5 px-2.5 text-[11px] font-bold uppercase tracking-[.08em] ${custom ? 'bg-[rgba(29,143,163,0.12)] text-[#146f80]' : 'bg-[rgba(102,116,111,0.14)] text-[#44564f]'}`}>
          {covers === null ? 'Cargando' : custom ? 'Personalizada' : 'Original'}
        </span>
      </div>

      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-[rgba(23,63,54,.1)]" role="progressbar" aria-label={`Subiendo la portada de ${label}`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span className="block h-full bg-river transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} hidden onChange={(event) => handleFile(event.target.files?.[0])} />
        <button type="button" className={BTN_INK_SM} disabled={busy || covers === null} onClick={() => fileRef.current?.click()}
          aria-describedby={hintId} aria-label={`Cambiar la portada de ${label}`}>
          <Icon name="pen" className="size-3.5" /> {busy && progress !== null ? `Subiendo ${Math.round(progress * 100)}%` : busy ? 'Guardando...' : 'Cambiar imagen'}
        </button>
        {custom && (
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => setConfirming(true)} aria-label={`Volver a la portada original de ${label}`}>
            Volver a la original
          </button>
        )}
      </div>
      <p id={hintId} className="m-0 text-[12px] leading-[1.45] text-[#53645c]">JPG, PNG o WebP de hasta 10 MB. Mejor horizontal: se recorta en las tarjetas de Explorar.</p>
      {message.text && (
        <p className={`m-0 text-[13px] font-semibold ${message.error ? 'text-[#b3442b]' : 'text-[#2f5a46]'}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>
      )}

      {confirming && (
        <ConfirmDialog title={`¿Volver a la portada original de ${label}?`} text="Se quita la imagen personalizada y vuelve la de siempre en Explorar y en la categoría."
          confirmLabel="Sí, volver a la original" onConfirm={restore} onCancel={() => setConfirming(false)} />
      )}
    </article>
  );
}
