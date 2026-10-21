import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { BTN_GHOST, BTN_INK_SM, FORM_INPUT, FORM_LABEL } from './uiStyles.js';
import { ACCEPTED_IMAGE_TYPES, uploadImage } from '../utils/uploadImage.js';
import { IMAGE_PATTERN } from '../utils/urlPatterns.js';
import { cdnImage } from '../utils/cloudinaryUrl.js';

// Campo de imagen de todo el sitio: sube a Cloudinary (utils/uploadImage.js; el backend firma y
// decide la carpeta segun `scope`) y entrega por onChange el secure_url, que es lo que guarda cada
// endpoint. Tambien se puede soltar el archivo encima. "Usar un enlace" despliega el campo de texto
// para URLs externas y rutas del sitio (/assets/...) ya existentes. Un error de subida no borra el
// valor anterior. scope "artist" necesita scopeRef (id): un artista nuevo sube sus fotos ya creado.
// onUploaded (opcional) avisa solo de las subidas, para quien guarda al momento (el avatar).

const LINK_BUTTON = 'cursor-pointer justify-self-start border-0 bg-transparent p-0 text-[13px] font-semibold text-ink underline decoration-[#d9cfbe] underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60';

export default function ImageField({
  label, value, onChange, onUploaded, scope, scopeRef, disabled = false, round = false, hint, required = false, id, className = '',
}) {
  const autoId = useId();
  const fieldId = id || `imagen-${autoId.replace(/:/g, '')}`;
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const [progress, setProgress] = useState(null); // null | 0..1 mientras sube
  const [message, setMessage] = useState({ error: false, text: '' });
  const [showUrl, setShowUrl] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = (value || '').trim();
  const uploading = progress !== null;
  const needsArtist = scope === 'artist' && !scopeRef;
  const canUpload = !disabled && !uploading && !needsArtist;
  const percent = Math.round((progress || 0) * 100);

  useEffect(() => { setFailed(false); }, [value]);
  // Si el formulario se cierra a mitad de subida, la subida se cancela.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleFile(file) {
    if (!file || !canUpload) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setMessage({ error: false, text: '' });
    setProgress(0);
    try {
      const secureUrl = await uploadImage(file, scope, scopeRef, { signal: controller.signal, onProgress: setProgress });
      onChange(secureUrl);
      setMessage({ error: false, text: 'Imagen subida.' });
      onUploaded?.(secureUrl);
    } catch (uploadError) {
      setMessage(uploadError.name === 'AbortError'
        ? { error: false, text: 'Subida cancelada. La imagen anterior se conserva.' }
        : { error: true, text: uploadError.message });
    } finally {
      abortRef.current = null;
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className={`grid min-w-0 gap-2 ${className}`} role="group" aria-labelledby={`${fieldId}-etiqueta`}>
      <span id={`${fieldId}-etiqueta`} className={FORM_LABEL}>{label}{required && ' *'}</span>

      <div
        className={`flex flex-wrap items-center gap-4 rounded-[16px] border border-dashed p-3 transition-colors duration-200 ${dragging ? 'border-ink bg-[rgba(23,63,54,.06)]' : 'border-[#d9cfbe] bg-white/50'}`}
        onDragOver={(event) => { if (canUpload) { event.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span className={`grid size-20 shrink-0 place-items-center overflow-hidden border border-[#d9cfbe] bg-cream text-muted max480:size-16 ${round ? 'rounded-full' : 'rounded-[14px]'}`} aria-hidden="true">
          {url && !failed
            ? <img src={cdnImage(url, { width: 160 })} alt="" className="size-full object-cover" decoding="async" onError={() => setFailed(true)} />
            : <Icon name="palette" className="size-7" />}
        </span>

        <div className="grid min-w-0 flex-1 basis-[190px] gap-2">
          {uploading ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-[rgba(23,63,54,.1)]" role="progressbar" aria-label={`Subiendo ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full rounded-full bg-river transition-[width] duration-200" style={{ width: `${percent}%` }} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">Subiendo... {percent} %</span>
                <button type="button" className={BTN_GHOST} onClick={() => abortRef.current?.abort()}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BTN_INK_SM} disabled={!canUpload} onClick={() => fileRef.current?.click()}>
                  <Icon name="arrow-left" className="size-3.5 rotate-90" /> {url ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {url && (
                  <button type="button" className={BTN_GHOST} disabled={disabled} onClick={() => { onChange(''); setMessage({ error: false, text: 'Imagen quitada.' }); }}>
                    Quitar imagen
                  </button>
                )}
              </div>
              <span className="text-[12px] leading-[1.4] text-muted">
                {needsArtist
                  ? 'Podrás subir fotos cuando el artista esté creado. Mientras, puedes usar un enlace.'
                  : 'JPG, PNG o WebP, hasta 10 MB. También puedes soltarla aquí.'}
              </span>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          disabled={!canUpload}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      <button type="button" className={LINK_BUTTON} aria-expanded={showUrl} aria-controls={fieldId} disabled={disabled} onClick={() => setShowUrl(!showUrl)}>
        {showUrl ? 'Ocultar el enlace' : 'Usar un enlace'}
      </button>
      {showUrl && (
        <input
          id={fieldId}
          className={FORM_INPUT}
          inputMode="url"
          value={value}
          onChange={(event) => { setMessage({ error: false, text: '' }); onChange(event.target.value); }}
          pattern={IMAGE_PATTERN}
          title="Una URL que empiece por https:// o una ruta del sitio como /assets/..."
          maxLength={500}
          placeholder="https://... o /assets/..."
          aria-labelledby={`${fieldId}-etiqueta`}
          aria-describedby={`${fieldId}-estado`}
          disabled={disabled || uploading}
          required={required}
        />
      )}

      <p id={`${fieldId}-estado`} className="m-0 text-[13px] text-muted" role="status">
        {message.error ? '' : message.text || (url && failed ? 'No pudimos mostrar esa imagen; revisa el enlace.' : '')}
      </p>
      {message.error && <p className="m-0 text-[13px] font-semibold text-[#b3442b]" role="alert">{message.text}</p>}
      {hint && <p className="m-0 text-[12px] leading-[1.45] text-muted">{hint}</p>}
    </div>
  );
}
