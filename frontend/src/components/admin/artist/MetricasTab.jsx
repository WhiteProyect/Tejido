import EmptyNote from '../../EmptyNote.jsx';
import Icon from '../../Icon.jsx';
import { BTN_GHOST, FORM_INPUT } from '../../uiStyles.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import { METRIC_TYPES } from '../../../utils/artistOptions.js';
import { ConfirmButton, ErrorAlert, Field, InlineForm, SectionHeader, buildPayload, useAction, useEditing, useFormValues } from './common.jsx';

// Pestana "Metricas" (tabla artist_metrics): POST /api/artists/{id}/metrics y PUT/DELETE
// .../metrics/{metric_id}. Son series en el tiempo: cada registro es un valor en una fecha y el panel
// del artista (GET .../dashboard) muestra el ultimo de cada tipo. Arriba, ese ultimo valor; abajo,
// el historial completo (el detalle ya viene ordenado por fecha, del mas reciente al mas antiguo).

const LABELS = Object.fromEntries(METRIC_TYPES);
const labelOf = (tipo) => LABELS[tipo] || tipo;
const formatValue = (value) => Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 });

// Fecha de hoy en la zona del navegador (toISOString daria la de UTC, que en Colombia ya es manana de noche).
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const byDateDesc = (a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id;

function valuesFrom(metric) {
  if (!metric) return { tipo: METRIC_TYPES[0][0], valor: '', fecha: today() };
  return { tipo: metric.tipo, valor: String(metric.valor), fecha: metric.fecha };
}

function MetricForm({ artistId, metric, onDone, onCancel }) {
  const isEdit = Boolean(metric);
  const form = useFormValues(valuesFrom(metric));
  const { values, bind } = form;
  const save = useAction();
  const formId = `metric-form-${metric?.id ?? 'nueva'}`;
  const legacy = metric && !LABELS[metric.tipo] ? metric.tipo : null;

  async function handleSubmit() {
    const body = buildPayload(form, isEdit, { numbers: ['valor'] });
    if (isEdit && Object.keys(body).length === 0) {
      save.setError('No hay cambios para guardar.');
      return;
    }
    const ok = await save.run(() => (isEdit
      ? adminArtistApi.metrics.update(artistId, metric.id, body)
      : adminArtistApi.metrics.create(artistId, body)));
    if (ok) await onDone(isEdit, values);
  }

  return (
    <InlineForm id={formId} title={isEdit ? `Editar registro de ${labelOf(metric.tipo).toLowerCase()}` : 'Nuevo registro'} onSubmit={handleSubmit} onCancel={onCancel} busy={save.busy} error={save.error} submitLabel={isEdit ? 'Guardar cambios' : 'Agregar registro'}>
      <Field label="Tipo">
        <select className={FORM_INPUT} {...bind('tipo')} autoFocus>
          {METRIC_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {legacy && <option value={legacy}>{legacy}</option>}
        </select>
      </Field>
      <Field label="Valor *" hint="Número, sin puntos de miles.">
        <input type="number" min={0} step="any" className={FORM_INPUT} {...bind('valor')} required inputMode="decimal" />
      </Field>
      <Field label="Fecha *" hint="Día en que se tomó el dato.">
        <input type="date" className={FORM_INPUT} {...bind('fecha')} required />
      </Field>
    </InlineForm>
  );
}

function LatestCards({ metrics }) {
  const latest = {};
  for (const metric of [...metrics].sort(byDateDesc)) if (!(metric.tipo in latest)) latest[metric.tipo] = metric;
  const extra = Object.keys(latest).filter((tipo) => !LABELS[tipo]).map((tipo) => [tipo, tipo]);
  return (
    <dl className="mt-6 mb-0 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 max800:grid-cols-[repeat(2,minmax(0,1fr))] max480:gap-3">
      {[...METRIC_TYPES, ...extra].map(([tipo, label]) => (
        <div key={tipo} className="flex min-w-0 flex-col-reverse rounded-[18px] border border-line bg-white/60 py-4 px-5 max480:px-3.5">
          <dt className="mt-2 text-[12px] font-bold uppercase tracking-[.1em] text-muted [overflow-wrap:anywhere] max480:text-[11px] max480:tracking-[.04em]">
            {label}
            <span className="mt-1 block font-semibold normal-case tracking-normal">{latest[tipo] ? `al ${latest[tipo].fecha}` : 'Sin datos'}</span>
          </dt>
          <dd className="m-0 text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink max480:text-[24px]">{latest[tipo] ? formatValue(latest[tipo].valor) : '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

function MetricRow({ metric, readOnly, onEdit, onDelete }) {
  const remove = useAction();
  return (
    <li className="flex items-center justify-between gap-4 border-b border-b-line py-3.5 last:border-b-0 max600:flex-col max600:items-stretch">
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-4 max480:grid-cols-[1fr_auto] max480:gap-x-3 max480:gap-y-0.5">
        <span className="text-[15px] font-bold text-ink max480:col-span-2">{labelOf(metric.tipo)}</span>
        <span className="text-[17px] font-extrabold text-ink tabular-nums">{formatValue(metric.valor)}</span>
        <span className="text-[14px] text-muted tabular-nums">{metric.fecha}</span>
      </div>
      {!readOnly && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max600:justify-start">
          <button type="button" className={BTN_GHOST} onClick={() => onEdit(metric)} disabled={remove.busy} aria-label={`Editar ${labelOf(metric.tipo)} del ${metric.fecha}`}><Icon name="pen" className="size-3.5" /> Editar</button>
          <ConfirmButton itemName={`${labelOf(metric.tipo)} del ${metric.fecha}`} busy={remove.busy} onConfirm={() => remove.run(() => onDelete(metric))} />
          <ErrorAlert className="w-full">{remove.error}</ErrorAlert>
        </div>
      )}
    </li>
  );
}

export default function MetricasTab({ artist, metrics, readOnly, onChanged }) {
  const { showToast } = useToast();
  const { editing, open, close } = useEditing('metric-form');
  const history = [...metrics].sort(byDateDesc);

  async function handleDone(isEdit, values) {
    close();
    const label = labelOf(values.tipo);
    showToast(isEdit
      ? { tone: 'menta', eyebrow: 'Métricas', title: 'Registro actualizado', text: `Guardamos el cambio en ${label.toLowerCase()}.` }
      : { tone: 'menta', eyebrow: 'Métricas', title: 'Registro agregado', text: `${label}: ${formatValue(values.valor)} al ${values.fecha}.` });
    await onChanged();
  }

  async function handleDelete(metric) {
    await adminArtistApi.metrics.remove(artist.id, metric.id);
    showToast({ tone: 'menta', eyebrow: 'Métricas', title: 'Registro eliminado', text: `Quitamos ${labelOf(metric.tipo).toLowerCase()} del ${metric.fecha}.` });
    await onChanged();
  }

  const formFor = (metric) => <MetricForm key={metric?.id ?? 'nueva'} artistId={artist.id} metric={metric} onDone={handleDone} onCancel={close} />;

  return (
    <div>
      <SectionHeader title="Métricas" count={history.length} actionLabel="Agregar registro" onAction={() => open('nueva')} showAction={!readOnly && editing !== 'nueva'} />
      <p className="mt-2 mb-0 text-[14px] text-muted">Cada registro es un dato en una fecha. El panel del artista muestra el más reciente de cada tipo.</p>
      {editing === 'nueva' && formFor(null)}
      <LatestCards metrics={metrics} />
      <h3 className="mt-8 mb-0 font-sans text-[18px] font-bold text-ink">Historial</h3>
      {history.length ? (
        <ul className="mt-2 mb-0 grid list-none gap-0 p-0">
          {history.map((metric) => (editing === metric.id
            ? <li key={metric.id}>{formFor(metric)}</li>
            : <MetricRow key={metric.id} metric={metric} readOnly={readOnly} onEdit={(item) => open(item.id)} onDelete={handleDelete} />))}
        </ul>
      ) : editing !== 'nueva' && (
        <div className="mt-4"><EmptyNote icon="columns" title="Aún no hay registros" text="Agrega oyentes, reproducciones o seguidores con su fecha para seguir la evolución del artista." /></div>
      )}
    </div>
  );
}
