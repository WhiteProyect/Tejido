import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, BTN_INK_SM, BTN_QUIET_SM, FORM_INPUT } from '../../uiStyles.js';
import { cdnImage } from '../../../utils/cloudinaryUrl.js';
import { ACCEPTED_IMAGE_TYPES, uploadImage, validateImageFile } from '../../../utils/uploadImage.js';
import { HINT, LIMITS } from './common.jsx';

// Varias fotos del perfil (manifestaciones y galeria). value: [{ url, alt_text, caption }] y
// onChange(lista) con la lista nueva; se guarda despues, con el boton del editor.
// - Elegir o soltar varios archivos: cada uno se valida (los invalidos se listan sin frenar al
//   resto) y sube a Cloudinary (scope "organization" salvo que se pida otro) con 3 a la vez. Solo caben `max` en total y
//   como mucho 12 por tanda (el backend firma 30 por minuto).
// - Cada subida muestra su estado (en cola, subiendo con %, error con reintento); una que falla no
//   impide guardar las demas. Cerrar el editor cancela las subidas en curso.
// - Cada foto: texto alternativo editable, pie opcional (withCaption), quitar y subir/bajar.
// onBusyChange(true/false) avisa mientras hay subidas, para que el editor no guarde a medias.
const CONCURRENCY = 3;
const MAX_BATCH = 12;
const STATUS = { queued: 'En cola', uploading: 'Subiendo', error: 'Error' };

let sequence = 0;

export default function MultiImageField({ label, value, onChange, max, withCaption = false, onBusyChange, scope = 'organization' }) {
  const id = useId();
  const fileRef = useRef(null);
  const valueRef = useRef(value);
  const queueRef = useRef([]);
  const controllers = useRef(new Map());
  const running = useRef(false);
  const [queue, setQueue] = useState([]);
  const [rejected, setRejected] = useState([]); // [{ name, reason }]
  const [dragging, setDragging] = useState(false);

  valueRef.current = value;
  const pending = queue.filter((item) => item.status !== 'error');
  const busy = pending.length > 0;
  const free = max - value.length - pending.length;

  useEffect(() => { onBusyChange?.(busy); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  // Al cerrar el editor se cancelan las subidas en curso.
  useEffect(() => () => controllers.current.forEach((controller) => controller.abort()), []);

  function setQueueState(next) {
    queueRef.current = next;
    setQueue(next);
  }
  const patch = (key, changes) => setQueueState(queueRef.current.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  async function upload(item) {
    const controller = new AbortController();
    controllers.current.set(item.key, controller);
    try {
      const url = await uploadImage(item.file, scope, undefined, {
        signal: controller.signal,
        onProgress: (progress) => patch(item.key, { progress }),
      });
      // Lista: pasa a las fotos del campo (al final, con el nombre del archivo como pista de alt).
      setQueueState(queueRef.current.filter((entry) => entry.key !== item.key));
      onChange([...valueRef.current, { url, alt_text: '', caption: '' }]);
    } catch (error) {
      if (error.name === 'AbortError') setQueueState(queueRef.current.filter((entry) => entry.key !== item.key));
      else patch(item.key, { status: 'error', error: error.message });
    } finally {
      controllers.current.delete(item.key);
    }
  }

  async function run() {
    if (running.current) return;
    running.current = true;
    const worker = async () => {
      for (;;) {
        const next = queueRef.current.find((item) => item.status === 'queued');
        if (!next) return;
        patch(next.key, { status: 'uploading', progress: 0, error: '' });
        await upload(next);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    running.current = false;
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = Math.min(free, MAX_BATCH);
    const accepted = [];
    const refused = [];
    for (const file of files) {
      try {
        validateImageFile(file);
      } catch (error) {
        refused.push({ name: file.name, reason: error.message });
        continue;
      }
      if (accepted.length >= room) refused.push({ name: file.name, reason: room === free ? `No cabe: el máximo es ${max} fotos.` : `Máximo ${MAX_BATCH} fotos por tanda; súbela en la siguiente.` });
      else accepted.push({ key: `f${++sequence}`, file, name: file.name, status: 'queued', progress: 0, error: '' });
    }
    setRejected(refused);
    if (accepted.length) {
      setQueueState([...queueRef.current, ...accepted]);
      run();
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  function retry(key) {
    patch(key, { status: 'queued', error: '' });
    run();
  }

  function update(index, changes) {
    onChange(value.map((photo, i) => (i === index ? { ...photo, ...changes } : photo)));
  }

  function move(index, delta) {
    const next = [...value];
    const [photo] = next.splice(index, 1);
    next.splice(index + delta, 0, photo);
    onChange(next);
  }

  return (
    <fieldset className="m-0 grid gap-3 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[12px] font-bold uppercase tracking-[.12em] text-muted">{label} <span className="normal-case tracking-normal">({value.length} de {max})</span></legend>

      {value.length > 0 && (
        <ul className="m-0 grid list-none gap-3 p-0">
          {value.map((photo, index) => (
            <li key={`${photo.url}-${index}`} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-[16px] border border-line bg-paper p-3 max480:grid-cols-1">
              <img src={cdnImage(photo.url, { width: 320, fit: 'fill' })} alt="" className="aspect-square w-24 rounded-[12px] object-cover max480:w-full max480:max-w-[200px]" />
              <div className="grid min-w-0 gap-2">
                <label className="grid gap-1 text-[12px] font-bold uppercase tracking-[.1em] text-muted">
                  Texto alternativo
                  <input className={FORM_INPUT} value={photo.alt_text || ''} maxLength={LIMITS.imageText}
                    onChange={(event) => update(index, { alt_text: event.target.value })} placeholder="Qué se ve en la foto" />
                </label>
                {withCaption && (
                  <label className="grid gap-1 text-[12px] font-bold uppercase tracking-[.1em] text-muted">
                    Pie de foto (opcional)
                    <input className={FORM_INPUT} value={photo.caption || ''} maxLength={LIMITS.imageText}
                      onChange={(event) => update(index, { caption: event.target.value })} />
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={BTN_QUIET_SM} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir la foto ${index + 1}`}>↑ Subir</button>
                  <button type="button" className={BTN_QUIET_SM} disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar la foto ${index + 1}`}>↓ Bajar</button>
                  <button type="button" className={BTN_GHOST} onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`Quitar la foto ${index + 1}`}>Quitar</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && <p className={HINT}>El texto alternativo describe la foto para quien no puede verla (lectores de pantalla). Ejemplo: “Bailarinas con faldas rojas en la plaza”.</p>}

      {queue.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0" aria-label="Subidas" aria-live="polite">
          {queue.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-white py-2 px-3 text-[14px]">
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{item.name}</span>
              <span className={item.status === 'error' ? 'font-bold text-[#b3442b]' : 'text-[#53645c]'}>
                {STATUS[item.status]}{item.status === 'uploading' && ` ${Math.round((item.progress || 0) * 100)}%`}
              </span>
              {item.status === 'uploading' && (
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-cream" aria-hidden="true">
                  <span className="block h-full bg-river transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round((item.progress || 0) * 100)}%` }} />
                </span>
              )}
              {item.status === 'error' && (
                <>
                  <span className="w-full text-[13px] text-[#b3442b]">{item.error}</span>
                  <button type="button" className={BTN_GHOST} onClick={() => retry(item.key)}>Reintentar</button>
                  <button type="button" className={BTN_QUIET_SM} onClick={() => setQueueState(queueRef.current.filter((entry) => entry.key !== item.key))}>Descartar</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <div className="rounded-[12px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">
          <p className="m-0 font-bold">{rejected.length === 1 ? 'Un archivo no se agregó:' : `${rejected.length} archivos no se agregaron:`}</p>
          <ul className="mt-1 mb-0 pl-5">{rejected.map((item) => <li key={item.name + item.reason}><strong>{item.name}</strong>: {item.reason}</li>)}</ul>
        </div>
      )}

      {free > 0 ? (
        <div
          className={`grid justify-items-center gap-2 rounded-[16px] border-2 border-dashed p-5 text-center transition-colors duration-200 motion-reduce:transition-none ${dragging ? 'border-river bg-[rgba(29,143,163,0.06)]' : 'border-[#d9cfbe] bg-paper'}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
        >
          <input ref={fileRef} type="file" multiple accept={ACCEPTED_IMAGE_TYPES.join(',')} hidden
            onChange={(event) => addFiles(event.target.files)} />
          <button type="button" className={BTN_INK_SM} onClick={() => fileRef.current?.click()} aria-describedby={`${id}-files-hint`}>
            <Icon name="pen" className="size-3.5" /> Elegir fotos
          </button>
          <p id={`${id}-files-hint`} className={HINT}>O suéltalas aquí. JPG, PNG o WebP de hasta 10 MB. Te caben {free} {free === 1 ? 'foto más' : 'fotos más'}.</p>
        </div>
      ) : (
        <p className={HINT}>Llegaste al máximo de {max} fotos. Quita alguna para agregar otra.</p>
      )}
    </fieldset>
  );
}
