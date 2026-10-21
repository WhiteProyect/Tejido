import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import ImageField from './ImageField.jsx';
import { BTN_GHOST, BTN_INK_SM, BTN_QUIET_SM, EYEBROW } from './uiStyles.js';
import { useToast } from '../context/ToastContext.jsx';
import { getInitials } from '../utils/initials.js';
import { cdnImage } from '../utils/cloudinaryUrl.js';

// Cabecera del perfil, comun a todos los roles: avatar (foto o iniciales) y nombre, ambos
// editables por el propio usuario con PATCH /api/me. La foto se sube a Cloudinary (ImageField,
// scope "avatar") y se guarda al terminar de subir; un enlace pegado o "Quitar imagen" se guardan
// con "Guardar foto". Tras guardar avisa con un toast y entrega el usuario nuevo a onUserUpdate
// (App lo guarda, asi el header del sitio cambia sin recargar).
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
  const avatarFormRef = useRef(null);
  // Enter y luego el blur del input llegan los dos con el mismo estado: el ref deja pasar uno.
  const nameEditOpen = useRef(false);

  useEffect(() => { setAvatarFailed(false); }, [user.avatar_url]);
  useEffect(() => {
    nameEditOpen.current = editingName;
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);
  useEffect(() => { if (editingAvatar) avatarFormRef.current?.querySelector('button')?.focus(); }, [editingAvatar]);

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
            <img src={cdnImage(user.avatar_url, { width: 184, fit: 'fill' })} alt={`Foto de ${user.name}`} decoding="async" onError={() => setAvatarFailed(true)} className="relative size-full rounded-full object-cover" />
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

        <button type="button" onClick={onLogout} className={`${BTN_GHOST} max600:ml-[92px]`}>
          <Icon name="logout" className="size-4" /> Cerrar sesión
        </button>
      </div>

      {editingAvatar && (
        <form
          ref={avatarFormRef}
          className="mt-6 grid max-w-[640px] gap-3"
          onSubmit={commitAvatar}
          onKeyDown={(event) => { if (event.key === 'Escape') setEditingAvatar(false); }}
        >
          <ImageField
            id="perfil-foto"
            label="Tu foto"
            value={avatarDraft}
            onChange={setAvatarDraft}
            onUploaded={(url) => commitAvatar(null, url)}
            scope="avatar"
            round
            disabled={saving}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving || avatarDraft.trim() === (user.avatar_url || '')} className={BTN_INK_SM}>
              {saving ? 'Guardando...' : 'Guardar foto'}
            </button>
            <button type="button" className={BTN_QUIET_SM} onClick={() => setEditingAvatar(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-4 mb-0 max-w-[640px] rounded-[14px] bg-[rgba(216,91,54,.08)] py-3 px-4 text-[14px] text-[#b3442b]" role="alert">{error}</p>}
    </header>
  );
}
