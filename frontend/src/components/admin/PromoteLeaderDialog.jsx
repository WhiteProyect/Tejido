import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';
import Modal from '../talent/Modal.jsx';
import { BTN_INK_MD, BTN_INK_OUTLINE_MD } from '../uiStyles.js';
import { branchParticipants, moveGestor, promoteToLeader, searchUsers, setLeader } from '../../services/adminApi.js';
import { branchLabel } from '../../utils/culturalBranches.js';
import { MUNICIPALITY_BY_SLUG } from '../../utils/municipalities.js';

// "Nombrar líder de <rama>" desde la cobertura de ramas, con dos origenes:
// - "Participantes de la rama" (por defecto si hay): PUT /api/admin/branches/{rama}/leader.
// - "Otra persona": buscador (espera de 300 ms, cancela las viejas) de cuentas activas. Un ciudadano con
//   el correo verificado pasa a gestor y lider (POST .../leader/promote, con el nombre de su organizacion);
//   un gestor de otra rama se mueve y queda de lider (POST /api/admin/users/{id}/move, sus publicaciones en
//   revision vuelven a borrador); uno de esta rama se nombra como participante. Deshabilitados con el
//   motivo: correo sin verificar, lideres de otra rama y administradores.
// Paso 2: resumen del efecto, aviso del lider actual (pasa a participante) y Confirmar / Volver. Modal del
// proyecto (talent/Modal.jsx): foco atrapado, Esc y el fondo cierran, el foco vuelve al boton que lo abrio.
// Errores del servidor dentro del dialogo (role="alert"), sin cerrarlo.
const MIN = 2;
const FIELD = 'w-full rounded-[12px] border border-line bg-white py-2.5 px-3.5 text-[16px] font-medium text-ink outline-none transition-colors duration-200 focus:border-ink';
const LABEL = 'grid gap-1.5 text-[14px] font-bold text-ink';
const ALERT = 'm-0 rounded-[14px] border border-[#e9b9a6] bg-[#fdf1ec] py-3 px-4 text-[14px] font-semibold text-[#9a3a1b]';
const NOTICE = 'm-0 flex items-start gap-2 rounded-[14px] border border-[#e8d29a] bg-[#fbf3dc] px-4 py-3 text-[14px] font-semibold leading-[1.5] text-[#5f4a10]';
const OPTION = 'grid w-full min-h-11 gap-0.5 rounded-[14px] border px-4 py-2.5 text-left font-sans transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

// Como se trata a cada cuenta del buscador "Otra persona" en esta rama.
export function candidateFor(user, branch) {
  if (user.role === 'ADMIN') return { blocked: 'Es administrador' };
  if (user.role === 'CIUDADANO') return user.email_verified ? { kind: 'ciudadano' } : { blocked: 'Correo sin verificar' };
  if (user.role === 'GESTOR') {
    if (!user.branch) return { blocked: 'No tiene una rama activa' };
    if (user.branch === branch) return user.is_leader ? { blocked: 'Ya es el líder de esta rama' } : { kind: 'participante', note: 'Ya participa en esta rama' };
    if (user.is_leader) return { blocked: `Es líder de ${user.branch_label}: primero quítale el liderazgo` };
    return { kind: 'mover', note: `Gestor de ${user.branch_label}` };
  }
  return { blocked: 'No se puede nombrar' };
}

export default function PromoteLeaderDialog({ branch, branchLabel, currentLeader, onClose, onPromoted }) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const inputRef = useRef(null);
  const orgRef = useRef(null);
  const pendingFocus = useRef(null);
  const focusOnMount = (name, ref) => (el) => {
    ref.current = el;
    if (el && pendingFocus.current === name) {
      pendingFocus.current = null;
      requestAnimationFrame(() => el.focus());
    }
  };
  const [participants, setParticipants] = useState({ loading: true, error: '', people: [] });
  const [origin, setOrigin] = useState(null); // 'participantes' | 'otra'
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ status: 'idle', results: [], error: '' });
  const [chosen, setChosen] = useState(null); // { person, kind }
  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Participantes de la rama (sin el lider): si hay, es el origen por defecto.
  useEffect(() => {
    let alive = true;
    branchParticipants(branch).then((people) => {
      if (!alive) return;
      const list = people.filter((person) => !person.is_leader);
      setParticipants({ loading: false, error: '', people: list });
      setOrigin(list.length ? 'participantes' : 'otra');
      pendingFocus.current = list.length ? 'tab' : 'buscar';
    }).catch((loadError) => {
      if (!alive) return;
      setParticipants({ loading: false, error: loadError.message, people: [] });
      setOrigin('otra');
      pendingFocus.current = 'buscar';
    });
    return () => { alive = false; };
  }, [branch]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN) { setSearch({ status: 'idle', results: [], error: '' }); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearch((current) => ({ ...current, status: 'loading', error: '' }));
      try {
        const results = await searchUsers(text, { signal: controller.signal });
        setSearch({ status: results.length ? 'done' : 'empty', results, error: '' });
      } catch (searchError) {
        if (searchError.name === 'AbortError') return;
        setSearch({ status: 'error', results: [], error: searchError.message });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  function choose(person, kind) {
    setChosen({ person, kind });
    setOrgName(person.name);
    setError('');
    pendingFocus.current = kind === 'ciudadano' ? 'org' : 'confirmar';
  }

  function back() {
    pendingFocus.current = origin === 'otra' ? 'buscar' : 'tab';
    setChosen(null);
    setError('');
  }

  function switchOrigin(next) {
    setOrigin(next);
    pendingFocus.current = next === 'otra' ? 'buscar' : null;
  }

  async function confirm(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const { person, kind } = chosen;
      if (kind === 'ciudadano') await promoteToLeader(branch, person.id, orgName.trim());
      else if (kind === 'mover') await moveGestor(person.id, { branch, lead: true });
      else await setLeader(branch, person.id);
      onPromoted(person);
    } catch (promoteError) {
      setError(promoteError.message);
      setSaving(false);
    }
  }

  const motionProps = (direction) => ({
    initial: reduce ? false : { opacity: 0, x: 12 * direction },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -12 * direction },
    transition: { duration: reduce ? 0 : 0.18, ease: 'easeInOut' },
  });

  const tabs = [['participantes', `Participantes de la rama (${participants.people.length})`], ['otra', 'Otra persona']];
  function onTabsKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = origin === 'otra' ? 'participantes' : 'otra';
    switchOrigin(next);
    requestAnimationFrame(() => document.getElementById(`${id}-tab-${next}`)?.focus());
  }

  const summary = chosen && (chosen.kind === 'ciudadano'
    ? <><strong>{chosen.person.name}</strong> pasará a ser gestor y líder de <strong>{branchLabel}</strong>.</>
    : chosen.kind === 'mover'
      ? <><strong>{chosen.person.name}</strong> pasará de {chosen.person.branch_label} a <strong>{branchLabel}</strong> y será su líder.</>
      : <><strong>{chosen.person.name}</strong> será líder de <strong>{branchLabel}</strong>.</>);

  return (
    <Modal animated title={`Nombrar líder de ${branchLabel}`} onClose={onClose}>
      <AnimatePresence mode="wait" initial={false}>
        {!chosen ? (
          <motion.div key="elegir" className="mt-5 grid gap-4" {...motionProps(-1)} data-paso="buscar">
            {origin && (
              <div className="flex flex-wrap gap-1 rounded-full bg-cream p-1" role="tablist" aria-label="De dónde sale el líder" onKeyDown={onTabsKey} data-origenes>
                {tabs.map(([key, text]) => {
                  const selected = origin === key;
                  return (
                    <button key={key} id={`${id}-tab-${key}`} type="button" role="tab" aria-selected={selected} aria-controls={`${id}-panel`} tabIndex={selected ? 0 : -1}
                      ref={key === origin ? (el) => { if (el && pendingFocus.current === 'tab') { pendingFocus.current = null; requestAnimationFrame(() => el.focus()); } } : undefined}
                      onClick={() => switchOrigin(key)} data-origen={key}
                      className={`min-h-11 flex-1 cursor-pointer rounded-full border-0 px-3 font-sans text-[14px] font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${selected ? 'bg-ink text-[#fff9ec]' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`}>
                      {text}
                    </button>
                  );
                })}
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              {origin === 'participantes' && (
                <motion.div key="participantes" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-participantes`} className="grid gap-3"
                  {...motionProps(-1)} data-origen-panel="participantes">
                  {participants.people.length ? (
                    <ul className="m-0 grid max-h-[320px] list-none gap-2 overflow-y-auto p-0" aria-label={`Participantes de ${branchLabel}`} data-participantes>
                      {participants.people.map((person) => (
                        <li key={person.id}>
                          <button type="button" disabled={!person.active} onClick={() => choose(person, 'participante')} data-participante={person.id}
                            className={`${OPTION} ${person.active ? 'cursor-pointer border-line bg-white text-ink hover:border-ink' : 'cursor-not-allowed border-line bg-[#f4efe6] text-[#4d5a55]'}`}>
                            <span className="text-[15px] font-bold [overflow-wrap:anywhere]">{person.name}</span>
                            <span className="text-[14px] text-[#3f514a] [overflow-wrap:anywhere]">{person.organization} · {person.published} publicadas · {person.in_review} en revisión</span>
                            {!person.active && <span className="text-[13px] font-bold text-[#9a3a1b]">Cuenta inactiva</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="m-0 text-[14px] text-[#53645c]">{participants.error || 'Esta rama aún no tiene participantes: busca a otra persona.'}</p>}
                </motion.div>
              )}
              {origin === 'otra' && (
                <motion.div key="otra" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-otra`} className="grid gap-4" {...motionProps(1)} data-origen-panel="otra">
                  <label className={LABEL} htmlFor={`${id}-q`}>
                    Busca por nombre o correo
                    <input ref={focusOnMount('buscar', inputRef)} id={`${id}-q`} className={FIELD} value={query} onChange={(event) => setQuery(event.target.value)}
                      autoComplete="off" maxLength={120} aria-describedby={`${id}-estado`} placeholder="Ej.: Ana o ana@correo.com" data-buscar-usuario />
                  </label>
                  <div id={`${id}-estado`} role="status" aria-live="polite" className="text-[14px] text-[#53645c]" data-estado-busqueda={search.status}>
                    {search.status === 'idle' && <p className="m-0">Escribe al menos {MIN} letras. Aparecen ciudadanos y gestores con la cuenta activa.</p>}
                    {search.status === 'loading' && <p className="m-0">Buscando…</p>}
                    {search.status === 'empty' && <p className="m-0">Sin resultados. Solo aparecen ciudadanos con la cuenta activa y el correo verificado, y gestores activos.</p>}
                    {search.status === 'done' && <p className="sr-only">{search.results.length} {search.results.length === 1 ? 'resultado' : 'resultados'}</p>}
                  </div>
                  {search.status === 'error' && <p className={ALERT} role="alert">{search.error}</p>}
                  {search.results.length > 0 && search.status !== 'error' && (
                    <ul className="m-0 grid max-h-[320px] list-none gap-2 overflow-y-auto p-0" aria-label="Personas encontradas" data-resultados-usuarios>
                      {search.results.map((user) => {
                        const { kind, blocked, note } = candidateFor(user, branch);
                        const town = MUNICIPALITY_BY_SLUG[user.municipality]?.name;
                        return (
                          <li key={user.id}>
                            <button type="button" disabled={Boolean(blocked)} onClick={() => choose(user, kind)} data-usuario={user.id} data-tipo-candidato={kind || 'bloqueado'}
                              aria-describedby={blocked || note ? `${id}-motivo-${user.id}` : undefined}
                              className={`${OPTION} ${blocked ? 'cursor-not-allowed border-line bg-[#f4efe6] text-[#4d5a55]' : 'cursor-pointer border-line bg-white text-ink hover:border-ink'}`}>
                              <span className="text-[15px] font-bold [overflow-wrap:anywhere]">{user.name}</span>
                              <span className="text-[14px] text-[#3f514a] [overflow-wrap:anywhere]">{user.email}{town ? ` · ${town}` : ''}</span>
                              {(blocked || note) && (
                                <span id={`${id}-motivo-${user.id}`} className={`text-[13px] font-bold ${blocked ? 'text-[#9a3a1b]' : 'text-[#245a43]'}`}>{blocked || note}</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.form key="confirmar" className="mt-5 grid gap-4" onSubmit={confirm} {...motionProps(1)} data-paso="confirmar" data-tipo={chosen.kind}>
            <p className="m-0 rounded-[14px] bg-[#f3e4c8] px-4 py-3 text-[15px] leading-[1.5] text-ink" data-resumen>{summary}</p>
            {chosen.kind === 'ciudadano' && (
              <label className={LABEL} htmlFor={`${id}-org`}>
                Nombre de su organización
                <input ref={focusOnMount('org', orgRef)} id={`${id}-org`} className={FIELD} value={orgName} onChange={(event) => setOrgName(event.target.value)} maxLength={120} data-nombre-organizacion />
                <span className="text-[13px] font-medium text-[#53645c]">Opcional: si lo dejas vacío, se usa su nombre. Si ya tenía una organización, se conserva la suya.</span>
              </label>
            )}
            {chosen.kind === 'mover' && (
              <p className={NOTICE} data-aviso-movimiento>
                <Icon name="arrow-right" className="mt-0.5 size-4 shrink-0" />
                <span>Deja {chosen.person.branch_label || branchLabel(chosen.person.branch)}: sus publicaciones en revisión vuelven a borrador (lo ya publicado sigue visible).</span>
              </p>
            )}
            {currentLeader && (
              <p className={NOTICE} data-aviso-lider>
                <Icon name="people" className="mt-0.5 size-4 shrink-0" />
                <span>{currentLeader.name} pasará a ser participante de la rama.</span>
              </p>
            )}
            {error && <p className={ALERT} role="alert" data-error-promover>{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 max480:grid max480:grid-cols-1">
              <button type="button" className={`${BTN_INK_OUTLINE_MD} max480:w-full`} onClick={back} disabled={saving}>Volver</button>
              <button type="submit" ref={(el) => { if (el && pendingFocus.current === 'confirmar') { pendingFocus.current = null; requestAnimationFrame(() => el.focus()); } }}
                className={`${BTN_INK_MD} max480:w-full`} disabled={saving} data-confirmar-lider>
                {saving ? 'Nombrando…' : 'Confirmar'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  );
}
