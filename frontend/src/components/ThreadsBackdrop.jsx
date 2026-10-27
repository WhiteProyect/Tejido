import { Component, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import Threads from './Threads.jsx';

// Fondo decorativo con los hilos animados del hero (Threads, sin cambiarlo) para otras pantallas.
// Guardas propias de este envoltorio, sin tocar Threads ni el hero:
// - con prefers-reduced-motion no se monta (queda el fondo plano de la pagina);
// - sin WebGL no se monta, y si Threads falla al iniciar, el error queda aqui (la pantalla sigue).
// Threads ya pausa la animacion fuera de pantalla o con la pestaña oculta y libera el contexto
// WebGL al desmontarse. `className` posiciona la capa; el resto de props van a Threads.

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {}

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

// La prueba de WebGL solo corre si de verdad se va a animar.
function Layer({ className, threadsProps }) {
  const [webgl] = useState(webglAvailable);
  if (!webgl) return null;
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <Boundary>
        <Threads {...threadsProps} />
      </Boundary>
    </div>
  );
}

export default function ThreadsBackdrop({ className = '', ...threadsProps }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return <Layer className={className} threadsProps={threadsProps} />;
}
