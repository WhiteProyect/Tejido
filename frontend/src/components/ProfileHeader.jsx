import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { EYEBROW } from './uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { getInitials } from '../utils/initials.js';

// Cabecera del perfil, comun a todos los roles: avatar (foto o iniciales) y nombre, ambos
// editables por el propio usuario con PATCH /api/me. La foto es una URL pegada (aun no hay
// subida de archivos). Tras guardar avisa con un toast y entrega el usuario nuevo a
// onUserUpdate (App lo guarda, asi el header del sitio cambia sin recargar).
const SMALL_BTN = 'inline-flex cursor-pointer items-center gap-2 rounded-full border py-2 px-4 text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const ICON_BTN = 'grid cursor-pointer place-items-center rounded-full border border-[#d9cfbe] bg-paper text-ink transition-colors duration-200 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

async function patchMe(changes) {
  const token = localStorage.getItem('tejido_token');
  const response = await fetch('/api/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(changes),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'No pudimos actualizar tu perfil.');
  return result.user;
}

export default function ProfileHeader({ user, roleLabel, markClass, onUserUpdate, onLogout }) {
  const { showToast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user.name);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(user.avatar_url || '');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  // Enter y luego el blur del input llegan los dos con el mismo estado: el ref deja pasar uno.
  const nameEditOpen = useRef(false);

  useEffect(() => { setAvatarFailed(false); }, [user.avatar_url]);
  useEffect(() => {
    nameEditOpen.current = editingName;
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);
  useEffect(() => { if (editingAvatar) avatarInputRef.current?.focus(); }, [editingAvatar]);

  async function save(changes) {
    setSaving(true);
    setError('');
    try {
      onUserUpdate(await patchMe(changes));
      showToast({ tone: 'menta', title: 'Perfil actualizado' });
      return true;
    } catch (saveError) {
      setError(saveError.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function commitName() {
    if (!nameEditOpen.current) return;
    nameEditOpen.current = false;
    const name = nameDraft.trim();
    setEditingName(false);
    if (!name || name === user.name) {
      setNameDraft(user.name);
      return;
    }
    if (!(await save({ name }))) setNameDraft(user.name);
  }

  async function commitAvatar(event, url = avatarDraft.trim()) {
    event?.preventDefault();
    if (await save({ avatar_url: url })) setEditingAvatar(false);
  }

  const showPhoto = user.avatar_url && !avatarFailed;

  return (
    <header className="mb-12">
      <div className="flex flex-wrap items-center gap-7 max600:gap-5">
        <div className="relative size-[92px] shrink-0 max600:size-[72px]">
          <span className="absolute -right-2.5 -bottom-2 size-full rounded-full border-2 border-ink/15" aria-hidden="true" />
          {showPhoto ? (
            <img src={user.avatar_url} alt={`Foto de ${user.name}`} onError={() => setAvatarFailed(true)} className="relative size-full rounded-full object-cover" />
          ) : (
            <span className={`relative flex size-full items-center justify-center rounded-full text-[30px] font-extrabold max600:text-[24px] ${markClass}`} aria-hidden="true">{getInitials(user.name)}</span>
          )}
          <button
            type="button"
            className={`${ICON_BTN} absolute -right-1 -bottom-1 size-9 [box-shadow:0_4px_12px_rgba(23,63,54,.14)]`}
            aria-label="Cambiar foto de perfil"
            aria-expanded={editingAvatar}
            onClick={() => { setAvatarDraft(user.avatar_url || ''); setEditingAvatar(!editingAvatar); setError(''); }}
          >
            <Icon name="pen" className="size-4" />
          </button>
        </div>

        {/* En movil el nombre ocupa el ancho junto al avatar (72 + 20 de gap) y el boton baja. */}
        <div className="min-w-0 flex-1 max600:basis-[calc(100%-92px)]">
          <p className={`${EYEBROW} mb-2`}>Mi perfil · {roleLabel}</p>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="m-0 w-full min-w-0 rounded-[10px] border-0 border-b-2 border-b-orange bg-[rgba(117,183,155,.14)] px-2 font-sans text-[length:clamp(34px,4.4vw,58px)] font-extrabold leading-[1.1] tracking-[-0.045em] text-ink outline-none"
              value={nameDraft}
              maxLength={120}
              aria-label="Tu nombre"
              disabled={saving}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitName();
                if (event.key === 'Escape') { setNameDraft(user.name); setEditingName(false); }
              }}
            />
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="m-0 min-w-0 cursor-text font-sans text-[length:clamp(34px,4.4vw,58px)] font-extrabold leading-[1] tracking-[-0.045em] text-ink [overflow-wrap:anywhere]" onClick={() => { setNameDraft(user.name); setEditingName(true); }}>{user.name}</h1>
              <button type="button" className={`${ICON_BTN} size-9`} aria-label="Editar nombre" onClick={() => { setNameDraft(user.name); setEditingName(true); setError(''); }}>
                <Icon name="pen" className="size-4" />
              </button>
            </div>
          )}
          <p className="mt-2 mb-0 text-[15px] text-muted">{user.email}</p>
        </div>

        <button type="button" onClick={onLogout} className={`${SMALL_BTN} max600:ml-[92px] border-[#d9cfbe] bg-transparent text-ink hover:border-ink`}>
          <Icon name="logout" className="size-[18px]" /> Cerrar sesión
        </button>
      </div>

      {editingAvatar && (
        <form className="mt-6 flex max-w-[640px] flex-wrap items-end gap-3" onSubmit={commitAvatar}>
          <label className="grid min-w-[240px] flex-1 gap-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted">
            Enlace de tu foto
            <input
              ref={avatarInputRef}
              className="rounded-[12px] border border-[#d9cfbe] bg-white py-2.5 px-3.5 text-[15px] font-medium normal-case tracking-normal text-ink outline-none focus:border-ink"
              // text y no url: el navegador bloquearia las rutas del sitio (/images/...), que el
              // backend si acepta. La validacion la hace PATCH /api/me.
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://..."
              value={avatarDraft}
              disabled={saving}
              onChange={(event) => setAvatarDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') setEditingAvatar(false); }}
            />
          </label>
          <button type="submit" disabled={saving || !avatarDraft.trim()} className={`${SMALL_BTN} border-ink bg-ink text-paper hover:bg-ink-deep disabled:cursor-not-allowed disabled:opacity-50`}>
            {saving ? 'Guardando...' : 'Guardar foto'}
          </button>
          {user.avatar_url && (
            <button type="button" disabled={saving} className={`${SMALL_BTN} border-[#d9cfbe] bg-transparent text-ink hover:border-ink`} onClick={() => commitAvatar(null, '')}>
              Quitar foto
            </button>
          )}
          <button type="button" className={`${SMALL_BTN} border-transparent bg-transparent text-muted hover:text-ink`} onClick={() => setEditingAvatar(false)}>
            Cancelar
          </button>
        </form>
      )}
      {error && <p className="mt-4 mb-0 max-w-[640px] rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
    </header>
  );
}
