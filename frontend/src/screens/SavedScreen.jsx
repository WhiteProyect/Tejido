import { useCallback, useEffect, useState } from 'react';
import EmptyNote, { EMPTY_NOTE_ACTION } from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import PublicationCard from '../components/PublicationCard.jsx';
import ScreenIntro from '../components/ScreenIntro.jsx';
import TalentCard from '../components/talent/TalentCard.jsx';
import { BTN_INK_MD, BTN_INK_OUTLINE_MD, SCREEN_SECTION } from '../components/uiStyles.js';
import { apiRequest } from '../utils/api.js';
import { KIND_LABELS } from '../utils/constants.js';

// Guardadas (#guardadas): todo lo que guardo el ciudadano (GET /api/me/saved), publicaciones y
// talento mezclados por fecha de guardado, con filtros por tipo. Solo el ciudadano guarda: sin
// sesion va a login (y vuelve aqui); gestor y admin ven un aviso. Al quitar un guardado desde su
// tarjeta, sale de la lista (el toast lo pone la tarjeta).
const CHIP = 'inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const TALENT = 'TALENTO_PERFIL';

function chipLabel(type) {
  if (type === TALENT) return 'Talento';
  // El tipo de publicacion TALENTO se distingue del talento contratable.
  return type === 'TALENTO' ? 'Publicaciones de talento' : (KIND_LABELS[type] || type);
}

export default function SavedScreen({ user, authReady }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [filter, setFilter] = useState('ALL');
  const isCitizen = user?.role === 'CIUDADANO';

  useEffect(() => { document.title = 'Mis guardados · TEJIDO'; }, []);

  // Sin sesion: a login, volviendo aqui despues de entrar.
  useEffect(() => {
    if (authReady && !user && window.location.hash === '#guardadas') {
      sessionStorage.setItem('tejido_return_to', 'guardadas');
      window.location.replace('#login');
    }
  }, [authReady, user]);

  const load = useCallback(async () => {
    setState({ loading: true, items: [], error: '' });
    try {
      const data = await apiRequest('/api/me/saved');
      const items = [
        ...data.publications.map((publication) => ({ key: `p-${publication.id}`, type: publication.kind, savedAt: publication.saved_at, publication })),
        ...data.talent.map((talent) => ({ key: `t-${talent.id}`, type: TALENT, savedAt: talent.saved_at, talent })),
      ].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
      setState({ loading: false, items, error: '' });
    } catch (error) {
      setState({ loading: false, items: [], error: error.message });
    }
  }, []);

  useEffect(() => { if (isCitizen) load(); }, [isCitizen, load]);

  function remove(key) {
    setState((current) => ({ ...current, items: current.items.filter((item) => item.key !== key) }));
  }

  let body;
  if (!authReady || !user) {
    body = <p className="m-0 py-6 text-[14px] text-muted" aria-busy="true">Cargando...</p>;
  } else if (!isCitizen) {
    body = (
      <div className="max-w-[560px]">
        <EmptyNote icon="bookmark" title="Guardar es para las cuentas de ciudadano"
          text="Como gestor o administrador no guardas contenidos: tu espacio de trabajo está en tu perfil."
          action={<a className={EMPTY_NOTE_ACTION} href="#perfil">Ir a mi perfil <Icon name="arrow-right" className="size-4" /></a>} />
      </div>
    );
  } else if (state.loading) {
    body = <p className="m-0 py-6 text-[14px] text-muted" role="status">Cargando tus guardados...</p>;
  } else if (state.error) {
    body = (
      <div className="max-w-[560px] rounded-[20px] border border-[rgba(216,91,54,.35)] bg-[#fffaf2] py-8 px-6 text-center" role="alert">
        <p className="m-0 text-[17px] font-bold text-ink">No pudimos cargar tus guardados</p>
        <p className="mt-1 mb-5 text-[14px] text-[#53645c]">{state.error}</p>
        <button type="button" className={BTN_INK_MD} onClick={load}>Reintentar</button>
      </div>
    );
  } else if (state.items.length === 0) {
    body = (
      <div className="max-w-[620px]">
        <EmptyNote icon="bookmark" title="Aún no has guardado nada" text="Guarda historias, eventos, oportunidades y talento para volver a ellos cuando quieras."
          action={(
            <div className="flex flex-wrap justify-center gap-3">
              <a className={BTN_INK_OUTLINE_MD} href="#explorar">Explorar <Icon name="arrow-right" className="size-4" /></a>
              <a className={BTN_INK_OUTLINE_MD} href="#talento">Ver talento <Icon name="arrow-right" className="size-4" /></a>
            </div>
          )} />
      </div>
    );
  } else {
    const counts = state.items.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {});
    const types = [...Object.keys(KIND_LABELS).filter((kind) => counts[kind]), ...(counts[TALENT] ? [TALENT] : [])];
    const active = filter === 'ALL' || counts[filter] ? filter : 'ALL';
    const visible = active === 'ALL' ? state.items : state.items.filter((item) => item.type === active);
    const chips = [['ALL', 'Todo', state.items.length], ...types.map((type) => [type, chipLabel(type), counts[type]])];
    body = (
      <>
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Filtrar guardados">
          {chips.map(([type, label, count]) => (
            <button key={type} type="button" aria-pressed={active === type} onClick={() => setFilter(type)}
              className={`${CHIP} ${active === type ? 'border-ink bg-ink text-white' : 'border-[#d9cfbe] bg-[#fffaf2] text-ink hover:border-ink'}`}>
              {label} <span className={active === type ? 'text-[rgba(255,255,255,.75)]' : 'text-[#53645c]'}>{count}</span>
            </button>
          ))}
        </div>
        <p className="mt-6 mb-5 text-[15px] font-semibold text-[#53645c]" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'guardado' : 'guardados'}
        </p>
        <ul className="m-0 grid list-none grid-cols-[repeat(2,minmax(0,1fr))] items-start gap-6 p-0 max1024:grid-cols-[minmax(0,1fr)]">
          {visible.map((item) => (
            <li key={item.key} className={`flex min-w-0 ${item.type === TALENT ? 'max1024:max-w-[460px]' : ''}`}>
              {item.type === TALENT ? (
                <TalentCard talent={item.talent} user={user} onFavoriteChange={(saved) => { if (!saved) remove(item.key); }} />
              ) : (
                <div className="w-full">
                  <PublicationCard publication={item.publication} user={user} returnTo="guardadas" onFavoriteChange={(saved) => { if (!saved) remove(item.key); }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section className={SCREEN_SECTION}>
      <ScreenIntro eyebrow="Tu selección personal" title="Mis guardados" description="Las historias, eventos, oportunidades y el talento que guardaste para volver a ellos." />
      {body}
    </section>
  );
}
