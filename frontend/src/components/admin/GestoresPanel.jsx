import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import { BRANCH_LABELS, CULTURAL_BRANCHES } from '../../utils/constants.js';

// Panel de administracion de gestores (dentro de AdminModule, ProfileScreen).
// Endpoints: GET/POST /api/admin/gestores, PATCH /api/admin/gestores/{id},
// POST /api/admin/gestores/{id}/resend-invite. El correo de invitacion sale automatico;
// igual se muestra el link para copiarlo (respaldo si Resend no lo entrega).

// Mismos valores que PANEL/H2 de ProfileScreen, para que el panel se vea como sus vecinos.
const PANEL = 'min-w-0 rounded-[28px] border border-[#e2d9ca] bg-[#fffaf2] p-8 max600:p-6';
const H2 = 'm-0 font-sans text-[26px] font-extrabold tracking-[-0.03em] text-ink';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
// Botones: base sin fondo ni color; cada variante pone los suyos (README, patron 15).
const BTN_BASE = `inline-flex cursor-pointer items-center gap-2 rounded-full border py-2.5 px-5 text-[14px] font-bold transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;
const BTN = `${BTN_BASE} border-ink bg-transparent text-ink hover:bg-ink hover:text-paper`;
const BTN_SOLID = `${BTN_BASE} border-ink bg-ink text-paper hover:bg-ink-deep`;
const BTN_SMALL = `inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white py-1.5 px-3 text-[13px] font-semibold text-ink transition-colors duration-200 hover:border-ink disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;
const LABEL = 'grid gap-1.5 text-[12px] font-bold uppercase tracking-[.1em] text-muted';
// text-[16px]: evita el zoom automatico de iOS al enfocar.
const FIELD = 'w-full rounded-[12px] border border-line bg-white py-2.5 px-3 text-[16px] font-medium normal-case tracking-normal text-ink outline-none transition-colors duration-200 focus:border-river';
const STATUS = {
  PENDIENTE: ['Pendiente', 'bg-[rgba(212,168,67,0.18)] text-[#7a5c12]'],
  ACTIVO: ['Activo', 'bg-[rgba(29,143,163,0.1)] text-[#146f80]'],
};
const EMPTY_FORM = { name: '', email: '', organization_name: '', branch: CULTURAL_BRANCHES[0], contact: '' };

async function api(url, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('tejido_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No fue posible completar la acción');
  return data;
}

// Link de invitacion en una caja copiable, con el resultado del envio del correo.
function InviteNotice({ notice, onClose }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(notice.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="mt-6 rounded-[20px] border border-[rgba(29,143,163,0.25)] bg-[rgba(29,143,163,0.06)] p-5" role="status">
      <div className="flex items-start justify-between gap-4">
        <p className="m-0 text-[15px] leading-[1.5] text-ink">
          <strong>{notice.title}</strong>{' '}
          {notice.emailSent
            ? `Le enviamos la invitación a ${notice.email}. Si no le llega, compártele este enlace:`
            : `No se pudo enviar el correo a ${notice.email}. Compártele este enlace para que active su cuenta:`}
        </p>
        <button type="button" onClick={onClose} className={`shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted hover:text-ink ${FOCUS}`} aria-label="Cerrar aviso">
          <Icon name="close" className="size-5" />
        </button>
      </div>
      <div className="mt-3 flex gap-2 max600:flex-col">
        <input className={`${FIELD} font-mono text-[13px]`} value={notice.link} readOnly onFocus={(event) => event.target.select()} aria-label="Enlace de invitación" />
        <button type="button" onClick={copy} className={BTN_SOLID}>
          <Icon name={copied ? 'check' : 'share'} className="size-4" /> {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="mt-2 mb-0 text-[12px] text-muted">El enlace es personal y vence en 7 días. Reenviar la invitación genera uno nuevo y anula este.</p>
    </div>
  );
}

function AddGestorForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await api('/api/admin/gestores', { method: 'POST', body: form });
      onCreated(form, result);
      setForm(EMPTY_FORM);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="mt-6 grid grid-cols-[1fr_1fr] gap-4 rounded-[20px] border border-line bg-white/60 p-5 max600:grid-cols-[1fr]" onSubmit={handleSubmit}>
      <label className={LABEL}>Nombre<input className={FIELD} value={form.name} onChange={set('name')} required autoComplete="off" /></label>
      <label className={LABEL}>Correo<input className={FIELD} type="email" value={form.email} onChange={set('email')} required autoComplete="off" /></label>
      <label className={LABEL}>Organización<input className={FIELD} value={form.organization_name} onChange={set('organization_name')} required /></label>
      <label className={LABEL}>Rama cultural
        <select className={FIELD} value={form.branch} onChange={set('branch')} required>
          {CULTURAL_BRANCHES.map((key) => <option key={key} value={key}>{BRANCH_LABELS[key]}</option>)}
        </select>
      </label>
      <label className={`${LABEL} col-span-2 max600:col-span-1`}>Contacto <span className="normal-case tracking-normal font-medium">(opcional: teléfono, red social o sitio)</span>
        <input className={FIELD} value={form.contact} onChange={set('contact')} />
      </label>
      {error && <p className="col-span-2 m-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b] max600:col-span-1" role="alert">{error}</p>}
      <div className="col-span-2 flex flex-wrap gap-3 max600:col-span-1">
        <button type="submit" className={BTN_SOLID} disabled={saving}><Icon name="send" className="size-4" /> {saving ? 'Creando...' : 'Crear e invitar'}</button>
        <button type="button" className={BTN} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function GestoresPanel() {
  const [state, setState] = useState({ loading: true, gestores: [], error: '' });
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState('');

  async function load() {
    try {
      const gestores = await api('/api/admin/gestores');
      setState({ loading: false, gestores, error: '' });
    } catch (loadError) {
      setState({ loading: false, gestores: [], error: loadError.message });
    }
  }

  useEffect(() => { load(); }, []);

  function handleCreated(form, result) {
    setShowForm(false);
    setNotice({ title: `Cuenta de gestor creada para ${form.name}.`, email: form.email, link: result.invite_link, emailSent: result.email_sent });
    load();
  }

  async function runRowAction(gestor, action) {
    setBusyId(gestor.id);
    setRowError('');
    try {
      if (action === 'resend') {
        const result = await api(`/api/admin/gestores/${gestor.id}/resend-invite`, { method: 'POST' });
        setNotice({ title: `Nueva invitación para ${gestor.name}.`, email: gestor.email, link: result.invite_link, emailSent: result.email_sent });
      } else {
        await api(`/api/admin/gestores/${gestor.id}`, { method: 'PATCH', body: { active: !gestor.active } });
      }
      await load();
    } catch (actionError) {
      setRowError(actionError.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={PANEL} aria-labelledby="admin-gestores">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="admin-gestores" className={`${H2} flex items-center gap-3`}><Icon name="people" className="size-6 text-river" /> Gestores culturales</h2>
          <p className="mt-2 mb-0 text-[14px] text-muted">Quienes publican en TEJIDO. Cada gestor activa su cuenta desde el enlace de invitación.</p>
        </div>
        {!showForm && (
          <button type="button" className={BTN_SOLID} onClick={() => { setShowForm(true); setNotice(null); }}>
            Agregar gestor
          </button>
        )}
      </div>

      {showForm && <AddGestorForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />}
      {notice && <InviteNotice notice={notice} onClose={() => setNotice(null)} />}
      {rowError && <p className="mt-4 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{rowError}</p>}

      {state.loading && <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>}
      {state.error && <p className="mt-6 mb-0 rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{state.error}</p>}
      {!state.loading && !state.error && state.gestores.length === 0 && (
        <p className="mt-6 mb-0 rounded-[20px] border border-dashed border-[#d9cfbe] py-8 px-6 text-center text-[14px] text-muted">Aún no hay gestores. Agrega el primero para enviarle su invitación.</p>
      )}
      {!state.loading && !state.error && state.gestores.length > 0 && (
        // relative: sin el, el sr-only (absolute) de la cabecera se ubica fuera del scroll y
        // ensancha la pagina en movil.
        <div className="relative mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-b-line text-[12px] uppercase tracking-[.1em] text-muted">
                <th className="py-3 pr-4 font-bold">Nombre</th>
                <th className="py-3 pr-4 font-bold">Correo</th>
                <th className="py-3 pr-4 font-bold">Organización</th>
                <th className="py-3 pr-4 font-bold">Rama cultural</th>
                <th className="py-3 pr-4 font-bold">Estado</th>
                <th className="py-3 font-bold"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {state.gestores.map((gestor) => {
                const [statusLabel, statusTone] = STATUS[gestor.status] || STATUS.PENDIENTE;
                const busy = busyId === gestor.id;
                return (
                  <tr key={gestor.id} className="border-b border-b-line align-middle last:border-b-0">
                    <td className="py-4 pr-4 font-bold text-ink">{gestor.name}</td>
                    <td className="py-4 pr-4 text-[#44564f]">{gestor.email}</td>
                    <td className="py-4 pr-4 text-[#44564f]">{gestor.organization_name || '–'}</td>
                    <td className="py-4 pr-4 text-[#44564f]">{BRANCH_LABELS[gestor.branch] || '–'}</td>
                    <td className="py-4 pr-4"><span className={`whitespace-nowrap rounded-full py-1 px-3 text-[12px] font-bold ${statusTone}`}>{statusLabel}</span></td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        {gestor.status === 'PENDIENTE' && (
                          <button type="button" className={BTN_SMALL} disabled={busy} onClick={() => runRowAction(gestor, 'resend')}>
                            <Icon name="send" className="size-3.5" /> Reenviar invitación
                          </button>
                        )}
                        <button type="button" className={BTN_SMALL} disabled={busy} onClick={() => runRowAction(gestor, 'toggle')}>
                          {gestor.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
