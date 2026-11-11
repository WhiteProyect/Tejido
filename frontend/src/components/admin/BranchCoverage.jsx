import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import BranchParticipants from './BranchParticipants.jsx';
import { BTN_GHOST, BTN_INK_SM } from '../uiStyles.js';
import { coverSources, useCategoryCovers } from '../../utils/categoryCovers.js';
import { CULTURAL_CATEGORIES } from '../../utils/constants.js';

// Cobertura de las 10 ramas culturales (GestoresPanel), calculada con la lista de
// GET /api/admin/gestores. Por rama: Cubierta (algun gestor ACTIVO), Invitacion pendiente
// (ninguno activo, alguno INVITADO que aun no acepta) o Sin gestor (un gestor INACTIVO, desactivado por
// el admin, no cubre la rama). Gestores sin rama o con una rama invalida no cuentan en
// ninguna tarjeta: se resumen en una nota. onAdd(rama) abre el formulario con esa rama elegida.
// overview (GET /api/admin/branches, por clave): lider, participantes y solicitudes pendientes de
// cada rama. "Participantes" despliega la lista con las acciones del admin (BranchParticipants);
// onChanged recarga la cobertura y la tabla tras una accion.
// Tarjeta en dos columnas (container queries: depende del ancho real de la tarjeta, no de la ventana):
// identidad (foto y nombre de la rama) | estado, lider, conteos, gestores y botones. Por
// tarjeta (ancho de su contenido): foto de 130 px en 160 px desde 440; 360-439: foto de 96 px; < 360: apilada. La lista pone 2 tarjetas
// por fila solo si su ancho llega a 940 px (con la barra de secciones a la derecha, desde ~1360 px).
// Fondos solidos: los tonos suaves de estado son colores opacos con texto >= 4,5:1.
const STATES = {
  covered: { label: 'Cubierta', tone: 'bg-[#dcefe5] text-[#245a43]', dot: 'bg-[#2f8a63]' },
  pending: { label: 'Invitación pendiente', tone: 'bg-[#f6ebcc] text-[#6b500f]', dot: 'bg-[#b8902a]' },
  empty: { label: 'Sin gestor', tone: 'bg-[#fbe4d9] text-[#9a3a1b]', dot: 'bg-[#c4562f]' },
};
const PRESS = 'transition-[background-color,border-color,color,transform] duration-200 active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export function branchCoverage(gestores) {
  const byBranch = Object.fromEntries(CULTURAL_CATEGORIES.map(([key]) => [key, []]));
  let unassigned = 0;
  for (const gestor of gestores) {
    if (gestor.branch && byBranch[gestor.branch]) byBranch[gestor.branch].push(gestor);
    else unassigned += 1;
  }
  const branches = CULTURAL_CATEGORIES.map(([key, label, slug]) => {
    const list = byBranch[key];
    const state = list.some((g) => g.status === 'ACTIVO') ? 'covered' : list.some((g) => g.status === 'INVITADO') ? 'pending' : 'empty';
    return { key, label, slug, gestores: list, state };
  });
  return { branches, unassigned };
}

const THUMB = 'size-24 shrink-0 rounded-[14px] @min-[440px]:size-[130px]';

function Thumb({ covers, branch }) {
  const sources = coverSources(covers, branch.key, branch.slug, { width: 260, fit: 'fill' });
  const [attempt, setAttempt] = useState(0);
  if (covers === null || attempt >= sources.length) {
    return <span className={`${THUMB} bg-[#e3eeee]`} aria-hidden="true" />;
  }
  // alt vacio: el nombre de la rama va justo debajo.
  return <img src={sources[attempt]} alt="" className={`${THUMB} object-cover`} onError={() => setAttempt(attempt + 1)} data-foto-rama />;
}

// onPromote(rama, etiqueta): "Nombrar líder" (sin lider) / "Cambiar líder…" (con lider) abre el dialogo
// "Nombrar líder de <rama>" (participantes u otra persona). onClearLeader(rama, etiqueta, lider): "Quitar
// liderazgo" (GestoresPanel pide la confirmacion).
export default function BranchCoverage({ gestores, overview = {}, onAdd, onChanged, onPromote, onClearLeader }) {
  const [openBranch, setOpenBranch] = useState(null);
  const reduce = useReducedMotion();
  const covers = useCategoryCovers();
  const { branches, unassigned } = branchCoverage(gestores);
  const count = (state) => branches.filter((b) => b.state === state).length;
  const covered = count('covered');
  const pending = count('pending');
  const empty = count('empty');

  return (
    <section className="mt-6" aria-labelledby="cobertura-ramas">
      <h3 id="cobertura-ramas" className="m-0 font-sans text-[19px] font-bold tracking-[-0.02em] text-ink">Cobertura de ramas</h3>
      <p className="mt-1 mb-0 text-[14px] text-[#53645c]">
        <strong className="text-ink">{covered} de {branches.length} ramas cubiertas</strong>
        {' · '}{pending} con invitación pendiente{' · '}{empty} sin gestor
      </p>

      <div className="@container mt-4">
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 @min-[940px]:grid-cols-2" data-tarjetas-ramas>
          {branches.map((branch, index) => {
            const state = STATES[branch.state];
            const isEmpty = branch.state === 'empty';
            const info = overview[branch.key];
            const open = openBranch === branch.key;
            return (
              <motion.li key={branch.key} data-rama={branch.key} data-estado-rama={branch.state}
                className="@container relative min-w-0 rounded-[20px] border border-[#ddd5c7] bg-[#fffdf6] p-4 [box-shadow:0_1px_2px_rgba(23,63,54,.06),0_2px_6px_rgba(23,63,54,.05)] transition-[border-color] duration-200 hover:border-ink @min-[420px]:p-5"
                initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut', delay: reduce ? 0 : Math.min(index, 9) * 0.04 }}
                whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.15 } }}>
                <div className="grid h-full grid-cols-1 gap-4 @min-[360px]:grid-cols-[112px_minmax(0,1fr)] @min-[360px]:gap-0 @min-[440px]:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="flex flex-col items-center gap-2.5 text-center @min-[360px]:border-r @min-[360px]:border-[#ddd5c7] @min-[360px]:pr-4" data-identidad-rama>
                    <Thumb covers={covers} branch={branch} />
                    <p className="m-0 font-sans text-[16px] font-bold leading-[1.25] text-ink [overflow-wrap:anywhere]">{branch.label}</p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 @min-[360px]:pl-4" data-info-rama>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full py-1 px-3 text-[13px] font-bold ${state.tone}`} data-pildora-estado>
                      <span className={`size-2 rounded-full ${state.dot}`} aria-hidden="true" />
                      {state.label}
                    </span>
                    {info && (
                      <div className="grid gap-2 text-[14px] leading-[1.4]">
                        {info.leader ? (
                          <p className="m-0 rounded-[12px] bg-[#f3e4c8] px-3 py-2 text-ink [overflow-wrap:anywhere]" data-lider>
                            <strong>Líder:</strong> {info.leader.name}
                            {info.leader.organization && ` · ${info.leader.organization}`}
                          </p>
                        ) : (
                          <p className="m-0 font-semibold text-[#b8502b]" data-sin-lider>Sin líder: el equipo gestiona esta rama</p>
                        )}
                        <p className="m-0 text-[#53645c]" data-conteos-rama>
                          {info.participants} {info.participants === 1 ? 'participante' : 'participantes'}
                          {' · '}
                          {info.pending_requests > 0 ? (
                            <a className={`font-bold text-river no-underline hover:underline ${FOCUS}`} href="#admin-dashboard/bandeja">
                              {info.pending_requests} {info.pending_requests === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
                            </a>
                          ) : 'sin solicitudes pendientes'}
                        </p>
                      </div>
                    )}
                    {branch.gestores.length > 0 && (
                      <ul className="m-0 grid list-none gap-1 p-0 text-[14px] leading-[1.4]" aria-label={`Gestores de ${branch.label}`}>
                        {branch.gestores.map((gestor) => (
                          <li key={gestor.id} className="min-w-0 [overflow-wrap:anywhere] text-[#44564f]">
                            <strong className="text-ink">{gestor.name}</strong>
                            {gestor.organization_name && ` · ${gestor.organization_name}`}
                            {gestor.status === 'INVITADO' && <span className="text-[#6b500f]"> (invitación pendiente)</span>}
                            {gestor.status === 'INACTIVO' && <span className="text-[#4d5a55]"> (inactivo)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1" data-acciones-rama>
                      <button
                        type="button"
                        className={`${isEmpty ? BTN_INK_SM : BTN_GHOST} ${FOCUS} ${PRESS} whitespace-nowrap`}
                        onClick={() => onAdd(branch.key)}
                        aria-label={`${isEmpty ? 'Crear gestor' : 'Agregar otro gestor'} para ${branch.label}`}
                      >
                        {isEmpty ? 'Crear gestor' : 'Agregar otro gestor'}
                      </button>
                      {onPromote && (
                        <button type="button" className={`${BTN_GHOST} ${FOCUS} ${PRESS} whitespace-nowrap`} onClick={() => onPromote(branch.key, branch.label)}
                          aria-label={info?.leader ? `Cambiar el líder de ${branch.label}` : `Nombrar líder de ${branch.label}`}
                          aria-haspopup="dialog" data-nombrar-usuario>
                          {info?.leader ? 'Cambiar líder…' : 'Nombrar líder'}
                        </button>
                      )}
                      {onClearLeader && info?.leader && (
                        <button type="button" className={`${BTN_GHOST} ${FOCUS} ${PRESS} whitespace-nowrap`} onClick={() => onClearLeader(branch.key, branch.label, info.leader)}
                          aria-label={`Quitar el liderazgo de ${branch.label} a ${info.leader.name}`} aria-haspopup="dialog" data-quitar-liderazgo>
                          Quitar liderazgo
                        </button>
                      )}
                      {!isEmpty && (
                        <button type="button" className={`${BTN_GHOST} ${FOCUS} ${PRESS} whitespace-nowrap`} aria-expanded={open}
                          aria-controls={`participantes-${branch.key}`} onClick={() => setOpenBranch(open ? null : branch.key)}
                          aria-label={`${open ? 'Ocultar' : 'Ver'} los participantes de ${branch.label}`}>
                          {open ? 'Ocultar participantes' : 'Participantes'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {open && (
                  <div id={`participantes-${branch.key}`} className="mt-4 border-t border-[#ddd5c7] pt-4">
                    <BranchParticipants branch={branch.key} branchLabel={branch.label} onChanged={onChanged} />
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>

      {unassigned > 0 && (
        <p className="mt-3 mb-0 rounded-[14px] bg-[rgba(212,168,67,0.12)] py-2.5 px-4 text-[14px] text-[#5f4a10]">
          Gestores sin rama asignada: <strong>{unassigned}</strong>. No cuentan en la cobertura; aparecen en la tabla de abajo.
        </p>
      )}
    </section>
  );
}
