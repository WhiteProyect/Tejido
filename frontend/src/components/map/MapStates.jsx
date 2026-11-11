import { TS } from '../territory/territoryStyles.js';

// Estados del Mapa vivo sobre el lienzo (cargando, vacio con Hilo, error). Solidos, sin degradados.
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-[#173f36] bg-[#173f36] px-5 font-sans text-[16px] font-bold text-[#fff9ec] hover:bg-[#2d5a3d] ${TS.focus}`;
const LINK_BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent px-3 font-sans text-[16px] font-bold text-[#173f36] underline decoration-2 underline-offset-4 ${TS.focus}`;

export function MapLoading() {
  return (
    <div className="tejido-reticula absolute inset-0 z-[900] grid place-items-center p-4" data-estado-mapa="cargando">
      <p className="m-0 rounded-full bg-[#173f36] px-5 py-3 text-center font-sans text-[16px] font-bold text-[#fff9ec]" role="status">
        Tejiendo los puntos del territorio…
      </p>
    </div>
  );
}

function Centered({ children, state }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[950] grid place-items-center p-4" data-estado-mapa={state}>
      {children}
    </div>
  );
}

// Vacio: sin puntos (o sin puntos con estos filtros). `inline` es la version para la vista de lista.
export function MapEmpty({ filtered, onClear, onRegion, inline = false }) {
  const card = (
    <div className={`pointer-events-auto flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[20px] border-2 border-[#173f36] bg-[#fff9ec] p-6 text-center max-[767px]:gap-2 max-[767px]:p-4 ${inline ? 'mx-auto' : ''}`}
      data-hilo data-vacio={filtered ? 'filtros' : 'sin-puntos'}>
      <img src="/images/hilo/hilo-saluda.webp" alt="" width="96" height="93" className="h-auto w-[96px] max-[767px]:w-[72px]" />
      <h2 className="m-0 font-sans text-[21px] font-extrabold leading-[1.2] text-[#173f36]" role="status">
        {filtered ? 'No hay puntos con estos filtros' : 'Aún no hay eventos con ubicación'}
      </h2>
      <p className="m-0 text-[15px] leading-[1.5] text-[#3f514a]">Prueba saltando a otro municipio del Bajo Cauca o quitando los filtros activos.</p>
      {filtered
        ? <button type="button" className={BTN} onClick={onClear}>Quitar filtros</button>
        : onRegion && <button type="button" className={BTN} onClick={onRegion}>Ver todo el Bajo Cauca</button>}
    </div>
  );
  return inline ? card : <Centered state="vacio">{card}</Centered>;
}

// Error de la API: borde ocre solido, Reintentar (44 px) y "Ver como lista" solo si ya habia puntos.
export function MapError({ onRetry, onList }) {
  return (
    <Centered state="error">
      <div className="pointer-events-auto flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[20px] border-[3px] border-[#b8502b] bg-[#fff9ec] p-6 text-center" role="alert">
        <h2 className="m-0 font-sans text-[20px] font-extrabold leading-[1.25] text-[#173f36]">No pudimos cargar los puntos del mapa</h2>
        <p className="m-0 text-[15px] leading-[1.5] text-[#3f514a]">Revisa tu conexión e inténtalo de nuevo en un momento.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className={BTN} onClick={onRetry} data-reintentar>Reintentar</button>
          {onList && <button type="button" className={LINK_BTN} onClick={onList}>Ver como lista</button>}
        </div>
      </div>
    </Centered>
  );
}

// Leaflet no cargo (sin red al pedir el modulo del mapa).
export function MapUnavailable({ onRetry, onList }) {
  return (
    <Centered state="sin-mapa">
      <div className="pointer-events-auto flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[20px] border-[3px] border-[#b8502b] bg-[#fff9ec] p-6 text-center" role="alert">
        <h2 className="m-0 font-sans text-[20px] font-extrabold leading-[1.25] text-[#173f36]">No pudimos abrir el mapa</h2>
        <p className="m-0 text-[15px] leading-[1.5] text-[#3f514a]">Revisa tu conexión y vuelve a intentarlo.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className={BTN} onClick={onRetry}>Reintentar</button>
          {onList && <button type="button" className={LINK_BTN} onClick={onList}>Ver como lista</button>}
        </div>
      </div>
    </Centered>
  );
}
