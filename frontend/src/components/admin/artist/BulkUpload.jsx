import { useEffect, useRef, useState } from 'react';
import { BTN_GHOST, BTN_INK_SM, BTN_QUIET_SM } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import { uploadImage, validateImageFile } from '../../../utils/uploadImage.js';
import { useUnsavedChanges } from './unsavedChanges.js';

// Subida de varias fotos a la galeria de un artista. Cada archivo se valida al elegirlo (los
// invalidos se listan y no frenan al resto), sube a Cloudinary con la misma utilidad que ImageField
// (utils/uploadImage.js, scope "artist") y, solo si la subida salio bien, crea su fila de
// artist_media. Los `orden` se fijan al elegir, en el orden de seleccion, desde el maximo actual + 1.
// Al terminar cada tanda: un solo toast de resumen y una sola recarga del detalle. Mientras haya
// subidas activas, salir de la pestana o recargar pide confirmacion (aviso de unsavedChanges.js).

export const MAX_BATCH = 20; // cada archivo gasta una firma y el backend permite 30 por minuto
const CONCURRENCY = 3;

const STATUS_TEXT = {
  queued: 'En cola',
  uploading: 'Subiendo',
  done: 'Lista',
  error: 'Error',
  invalid: 'No válida',
  canceled: 'Cancelada',
  paused: 'Pendiente',
};

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

export function useBulkUpload({ artistId, nextOrden, onChanged }) {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');
  const itemsRef = useRef([]);
  const controllers = useRef(new Map());
  const running = useRef(false);
  const paused = useRef(false);
  const runKeys = useRef(new Set());
  const sequence = useRef(0);

  const active = items.some((item) => item.status === 'queued' || item.status === 'uploading');
  useUnsavedChanges(active);
  // Si el editor se cierra a mitad, se cancelan las subidas en curso (las filas ya creadas quedan).
  useEffect(() => () => controllers.current.forEach((controller) => controller.abort()), []);

  function commit(next) {
    itemsRef.current = next;
    setItems(next);
  }

  function update(key, patch) {
    commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function processItem(item) {
    const controller = new AbortController();
    controllers.current.set(item.key, controller);
    try {
      // Si la subida ya habia salido bien y fallo crear la fila, el reintento no vuelve a subir.
      const url = item.url || await uploadImage(item.file, 'artist', artistId, {
        signal: controller.signal,
        onProgress: (progress) => update(item.key, { progress }),
      });
      update(item.key, { url, progress: 1 });
      await adminArtistApi.media.create(artistId, { tipo: 'image', url, orden: item.orden, destacado: false });
      update(item.key, { status: 'done' });
    } catch (error) {
      if (error.name === 'AbortError') {
        update(item.key, { status: 'canceled', error: '' });
      } else if (error.status === 429) {
        // Limite de firmas por minuto: se detiene la tanda y lo que falta queda pendiente.
        paused.current = true;
        update(item.key, { status: 'paused', error: error.message });
        commit(itemsRef.current.map((entry) => (entry.status === 'queued' ? { ...entry, status: 'paused' } : entry)));
      } else {
        update(item.key, { status: 'error', error: error.message });
      }
    } finally {
      controllers.current.delete(item.key);
    }
  }

  function summarize() {
    const run = itemsRef.current.filter((item) => runKeys.current.has(item.key));
    const done = run.filter((item) => item.status === 'done').length;
    const failed = run.filter((item) => item.status === 'error').length;
    const invalid = run.filter((item) => item.status === 'invalid').length;
    const pending = run.filter((item) => item.status === 'paused').length;
    const canceled = run.filter((item) => item.status === 'canceled').length;
    const parts = [plural(done, 'foto agregada', 'fotos agregadas')];
    if (failed) parts.push(`${failed} ${failed === 1 ? 'falló' : 'fallaron'}`);
    if (invalid) parts.push(plural(invalid, 'no válida', 'no válidas'));
    if (canceled) parts.push(plural(canceled, 'cancelada', 'canceladas'));
    if (pending) parts.push(plural(pending, 'pendiente', 'pendientes'));
    return { done, text: parts.join(', ') };
  }

  async function runQueue() {
    if (running.current) return;
    running.current = true;
    paused.current = false;
    const worker = async () => {
      for (;;) {
        if (paused.current) return;
        const next = itemsRef.current.find((item) => item.status === 'queued');
        if (!next) return;
        runKeys.current.add(next.key);
        update(next.key, { status: 'uploading', progress: 0, error: '' });
        await processItem(next);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    running.current = false;
    const { done, text } = summarize();
    runKeys.current = new Set();
    showToast({
      tone: 'menta',
      eyebrow: 'Galería',
      title: done ? 'Fotos agregadas' : 'No se agregó ninguna foto',
      text: paused.current ? `${text}. Espera un minuto y pulsa «Reintentar pendientes».` : `${text}.`,
    });
    if (done) await onChanged();
  }

  function start(fileList) {
    if (active) return;
    const files = [...fileList];
    setNotice(files.length > MAX_BATCH
      ? `Elegiste ${files.length} archivos: se suben los primeros ${MAX_BATCH} (máximo por tanda). Sube el resto en otra tanda.`
      : '');
    const used = itemsRef.current.filter((item) => item.status !== 'invalid').map((item) => item.orden);
    let orden = Math.max(nextOrden - 1, ...used, 0);
    const added = files.slice(0, MAX_BATCH).map((file) => {
      sequence.current += 1;
      const base = { key: `foto-${sequence.current}`, file, name: file.name, progress: 0, url: null, error: '' };
      try {
        validateImageFile(file);
        orden += 1;
        return { ...base, status: 'queued', orden };
      } catch (error) {
        return { ...base, status: 'invalid', error: error.message };
      }
    });
    added.filter((item) => item.status === 'invalid').forEach((item) => runKeys.current.add(item.key));
    commit([...itemsRef.current.filter((item) => item.status !== 'done' && item.status !== 'invalid'), ...added]);
    runQueue();
  }

  function retry(key) {
    update(key, { status: 'queued', error: '' });
    runQueue();
  }

  function retryPending() {
    commit(itemsRef.current.map((item) => (['paused', 'error', 'canceled'].includes(item.status) ? { ...item, status: 'queued', error: '' } : item)));
    runQueue();
  }

  function cancel(key) {
    const item = itemsRef.current.find((entry) => entry.key === key);
    if (item?.status === 'queued') update(key, { status: 'canceled' });
    else controllers.current.get(key)?.abort();
  }

  function cancelAll() {
    commit(itemsRef.current.map((item) => (item.status === 'queued' ? { ...item, status: 'canceled' } : item)));
    controllers.current.forEach((controller) => controller.abort());
  }

  function clear() {
    if (active) return;
    commit([]);
    setNotice('');
  }

  return { items, notice, active, start, retry, retryPending, cancel, cancelAll, clear };
}

export function BulkUploadPanel({ bulk }) {
  const { items, notice, active } = bulk;
  if (!items.length && !notice) return null;
  const count = (status) => items.filter((item) => item.status === status).length;
  const retryable = items.some((item) => ['paused', 'error', 'canceled'].includes(item.status));
  const summary = [
    active ? `Listas ${count('done')} de ${items.filter((item) => item.status !== 'invalid').length}` : count('done') && plural(count('done'), 'lista', 'listas'),
    count('error') && plural(count('error'), 'con error', 'con error'),
    count('invalid') && plural(count('invalid'), 'no válida', 'no válidas'),
    count('paused') && plural(count('paused'), 'pendiente', 'pendientes'),
    count('canceled') && plural(count('canceled'), 'cancelada', 'canceladas'),
  ].filter(Boolean).join(' · ');

  return (
    <section className="mt-6 rounded-[20px] border border-line bg-white/60 p-5" aria-label="Subida de varias fotos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 font-sans text-[18px] font-bold text-ink">Subida de varias fotos</h3>
        <div className="flex flex-wrap gap-2">
          {active && <button type="button" className={BTN_GHOST} onClick={bulk.cancelAll}>Cancelar todo</button>}
          {!active && retryable && <button type="button" className={BTN_INK_SM} onClick={bulk.retryPending}>Reintentar pendientes</button>}
          {!active && <button type="button" className={BTN_QUIET_SM} onClick={bulk.clear}>Cerrar</button>}
        </div>
      </div>
      <p className="mt-2 mb-0 text-[14px] text-muted" role="status">{summary}</p>
      {notice && <p className="mt-2 mb-0 text-[14px] font-semibold text-[#7a5c12]">{notice}</p>}
      <ol className="mt-4 mb-0 grid list-none gap-2 p-0">
        {items.map((item) => {
          const percent = Math.round(item.progress * 100);
          const tone = item.status === 'done' ? 'text-[#146f80]' : ['error', 'invalid', 'paused'].includes(item.status) ? 'text-[#b3442b]' : 'text-muted';
          return (
            <li key={item.key} className="grid gap-1.5 rounded-[14px] bg-white/70 py-2.5 px-3.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink max480:basis-full" title={item.name}>{item.name}</span>
                <span className={`text-[13px] font-bold ${tone}`}>
                  {STATUS_TEXT[item.status]}{item.status === 'uploading' && ` ${percent} %`}
                </span>
                {['error', 'canceled', 'paused'].includes(item.status) && !active && (
                  <button type="button" className={BTN_GHOST} onClick={() => bulk.retry(item.key)} aria-label={`Reintentar ${item.name}`}>Reintentar</button>
                )}
                {['queued', 'uploading'].includes(item.status) && (
                  <button type="button" className={BTN_QUIET_SM} onClick={() => bulk.cancel(item.key)} aria-label={`Cancelar ${item.name}`}>Cancelar</button>
                )}
              </div>
              {item.status === 'uploading' && (
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(23,63,54,.1)]" role="progressbar" aria-label={`Subiendo ${item.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <div className="h-full rounded-full bg-river transition-[width] duration-200" style={{ width: `${percent}%` }} />
                </div>
              )}
              {item.error && <span className="text-[13px] text-[#b3442b]">{item.error}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
