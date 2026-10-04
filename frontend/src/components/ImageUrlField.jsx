import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { FORM_INPUT, FORM_LABEL } from './uiStyles.js';

// Imagen por enlace pegado (aun no hay subida de archivos), mismo patron que la foto de
// perfil de ProfileHeader: campo de texto con teclado de URL (type="text": type="url"
// bloquearia las rutas del sitio /images/..., que el backend acepta) y una vista previa que
// vuelve al icono si el enlace no carga. La validacion final la hace el backend.
export default function ImageUrlField({ label, value, onChange, disabled, round = false, hint }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [value]);
  const url = value.trim();

  return (
    <div className="flex items-end gap-4">
      <span className={`grid size-16 shrink-0 place-items-center overflow-hidden border border-[#d9cfbe] bg-cream text-muted ${round ? 'rounded-full' : 'rounded-[14px]'}`} aria-hidden="true">
        {url && !failed ? <img src={url} alt="" className="size-full object-cover" onError={() => setFailed(true)} /> : <Icon name="palette" className="size-6" />}
      </span>
      <label className={`${FORM_LABEL} flex-1`}>
        {label}
        <input
          className={FORM_INPUT}
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="https://..."
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {(hint || (url && failed)) && (
          <span className={`text-[12px] font-medium normal-case tracking-normal ${url && failed ? 'text-[#b3442b]' : 'text-muted'}`}>
            {url && failed ? 'No pudimos cargar esa imagen; revisa el enlace.' : hint}
          </span>
        )}
      </label>
    </div>
  );
}
