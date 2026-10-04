import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Toast from '../components/Toast.jsx';

// Avisos breves (toasts) del "Modelo de Alertas TEJIDO": acompañan, no dirigen. Nunca
// bloquean la pantalla, hay uno solo a la vez (uno nuevo reemplaza al anterior) y se van
// solos a los 4 s. Son una confirmacion adicional: los mensajes en linea de cada pantalla
// se quedan como estan.
//   const { showToast } = useToast();
//   showToast({ tone: 'menta', eyebrow: 'Hilo guardado', title: 'Sumaste este hilo a tu ruta', text: '...' });
// tone: una clave de TOAST_TONES (utils/constants.js). eyebrow y text son opcionales.
export const TOAST_DURATION = 4000;

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const nextId = useRef(0);

  const dismissToast = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback(({ tone = 'menta', eyebrow, title, text }) => {
    clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ id: nextId.current, tone, eyebrow, title, text });
    timer.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Toast toast={toast} onDismiss={dismissToast} duration={TOAST_DURATION} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return { showToast: useContext(ToastContext) };
}
