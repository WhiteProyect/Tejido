import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../../context/ToastContext.jsx';

// Estado de un editor del perfil: valores, si hay cambios sin guardar (se avisa al panel con
// onDirtyChange) y el guardado (estado "Guardando...", error del backend sin perder lo escrito,
// toast menta de exito y onSaved para recargar la vista previa y cerrar el editor).
export default function useEditorForm(initial, { onDirtyChange, onSaved }) {
  const { showToast } = useToast();
  const initialJson = useRef(JSON.stringify(initial));
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(values) !== initialJson.current;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));

  // save(fn): fn hace las llamadas; si lanza, el mensaje queda en el formulario.
  async function save(fn, toastText = 'Así se ve ya en tu perfil público.') {
    setSaving(true);
    setError('');
    try {
      await fn(values);
      initialJson.current = JSON.stringify(values);
      onDirtyChange?.(false);
      showToast({ tone: 'menta', eyebrow: 'Hilo actualizado', title: 'Perfil actualizado', text: toastText });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return { values, setValues, set, saving, error, setError, dirty, save };
}
