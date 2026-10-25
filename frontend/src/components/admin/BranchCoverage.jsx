import { useState } from 'react';
import { BTN_GHOST, BTN_INK_SM } from '../uiStyles.js';
import { coverSources, useCategoryCovers } from '../../utils/categoryCovers.js';
import { CULTURAL_CATEGORIES } from '../../utils/constants.js';

// Cobertura de las 10 ramas culturales (GestoresPanel), calculada con la lista de
// GET /api/admin/gestores. Por rama: Cubierta (algun gestor ACTIVO), Invitacion pendiente
// (ninguno activo, alguno PENDIENTE; un gestor desactivado tambien figura como PENDIENTE, igual
// que en el backend) o Sin gestor. Gestores sin rama o con una rama invalida no cuentan en
// ninguna tarjeta: se resumen en una nota. onAdd(rama) abre el formulario con esa rama elegida.
const STATES = {
  covered: { label: 'Cubierta', tone: 'bg-[rgba(117,183,155,0.2)] text-[#2f6b52]', dot: 'bg-mint' },
  pending: { label: 'Invitación pendiente', tone: 'bg-[rgba(212,168,67,0.18)] text-[#7a5c12]', dot: 'bg-gold' },
  empty: { label: 'Sin gestor', tone: 'bg-[rgba(216,91,54,0.12)] text-[#a8431f]', dot: 'bg-orange' },
};
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
    const state = list.some((g) => g.status === 'ACTIVO') ? 'covered' : list.length ? 'pending' : 'empty';
    return { key, label, slug, gestores: list, state };
  });
  return { branches, unassigned };
}

function Thumb({ covers, branch }) {
  const sources = coverSources(covers, branch.key, branch.slug, { width: 160, fit: 'fill' });
  const [attempt, setAttempt] = useState(0);
  if (covers === null || attempt >= sources.length) {
    return <span className="size-12 shrink-0 rounded-[12px] bg-[rgba(29,143,163,0.12)]" aria-hidden="true" />;
  }
  return <img src={sources[attempt]} alt="" className="size-12 shrink-0 rounded-[12px] object-cover" onError={() => setAttempt(attempt + 1)} />;
}

export default function BranchCoverage({ gestores, onAdd }) {
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

      <ul className="mt-4 mb-0 grid list-none grid-cols-2 gap-3 p-0 max768:grid-cols-1">
        {branches.map((branch) => {
          const state = STATES[branch.state];
          const isEmpty = branch.state === 'empty';
          return (
            <li key={branch.key} className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-line bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <Thumb covers={covers} branch={branch} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[16px] font-bold leading-[1.25] text-ink">{branch.label}</p>
                  <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full py-0.5 px-2.5 text-[12px] font-bold ${state.tone}`}>
                    <span className={`size-2 rounded-full ${state.dot}`} aria-hidden="true" />
                    {state.label}
                  </span>
                </div>
              </div>
              {branch.gestores.length > 0 && (
                <ul className="m-0 grid list-none gap-1 p-0 text-[14px] leading-[1.4]" aria-label={`Gestores de ${branch.label}`}>
                  {branch.gestores.map((gestor) => (
                    <li key={gestor.id} className="min-w-0 [overflow-wrap:anywhere] text-[#44564f]">
                      <strong className="text-ink">{gestor.name}</strong>
                      {gestor.organization_name && ` · ${gestor.organization_name}`}
                      {gestor.status !== 'ACTIVO' && <span className="text-[#7a5c12]"> (pendiente)</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto">
                <button
                  type="button"
                  className={`${isEmpty ? BTN_INK_SM : BTN_GHOST} ${FOCUS}`}
                  onClick={() => onAdd(branch.key)}
                  aria-label={`${isEmpty ? 'Crear gestor' : 'Agregar otro gestor'} para ${branch.label}`}
                >
                  {isEmpty ? 'Crear gestor' : 'Agregar otro gestor'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {unassigned > 0 && (
        <p className="mt-3 mb-0 rounded-[14px] bg-[rgba(212,168,67,0.12)] py-2.5 px-4 text-[14px] text-[#5f4a10]">
          Gestores sin rama asignada: <strong>{unassigned}</strong>. No cuentan en la cobertura; aparecen en la tabla de abajo.
        </p>
      )}
    </section>
  );
}
