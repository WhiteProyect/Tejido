import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import MiniMap from '../components/municipality/MiniMap.jsx';
import MunicipalityCover, { entranceDelays } from '../components/municipality/MunicipalityCover.jsx';
import { MemoryCard, QuickFacts } from '../components/municipality/MunicipalityInfo.jsx';
import MunicipalityPeople from '../components/municipality/MunicipalityPeople.jsx';
import MunicipalityPublications from '../components/municipality/MunicipalityPublications.jsx';
import OtherMunicipalities from '../components/municipality/OtherMunicipalities.jsx';
import { BTN_INK_MD } from '../components/uiStyles.js';
import { apiRequest } from '../utils/api.js';
import { getMunicipality } from '../utils/municipalities.js';
import { pendingMorph } from '../utils/municipalityTransition.js';

// Pantalla de un municipio: #municipio/<slug>. Portada, datos rapidos, memoria y mini mapa salen de
// utils/municipalities.js y se pintan al instante (el morph desde el hub necesita la portada
// montada); publicaciones, talento y artistas, de GET /api/municipalities/{slug} (solo lo publico).
// Slug invalido -> #municipios. Al entrar o cambiar de municipio: arriba, titulo de la pestaña y foco
// en el h1. Sigue montada al pasar de un municipio a otro (misma pantalla en App): la portada y los
// datos llevan key={slug} para repetir su entrada en cascada.
function Skeleton() {
  return (
    <div className="grid gap-5 motion-safe:animate-pulse" aria-hidden="true">
      <div className="h-10 w-2/3 max-w-[420px] rounded-xl bg-[#ece4d6]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-[180px] rounded-2xl bg-[#f1ebe0]" />
        <div className="h-[180px] rounded-2xl bg-[#f1ebe0]" />
        <div className="h-[180px] rounded-2xl bg-[#f1ebe0]" />
      </div>
    </div>
  );
}

export default function MunicipalityScreen({ slug, user }) {
  const municipality = getMunicipality(slug);
  const headingRef = useRef(null);
  // Llego desde una pildora del hub: la portada crece desde ella (solo la primera vez que se monta).
  const [morph] = useState(() => pendingMorph());
  const viaMorph = morph?.slug === slug;
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState({ status: 'loading', data: null, slug: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!municipality) window.location.replace('#municipios');
  }, [municipality]);

  useEffect(() => {
    if (!municipality) return;
    document.title = `${municipality.name} · TEJIDO`;
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [municipality]);

  useEffect(() => {
    if (!municipality) return undefined;
    let alive = true;
    setState({ status: 'loading', data: null, slug });
    apiRequest(`/api/municipalities/${slug}`)
      .then((data) => { if (alive) setState({ status: 'ready', data, slug }); })
      .catch(() => { if (alive) setState({ status: 'error', data: null, slug }); });
    return () => { alive = false; };
  }, [slug, municipality, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  if (!municipality) return null;
  const ready = state.status === 'ready' && state.slug === slug;

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-[5vw] pt-8 pb-24 max600:gap-8 max600:px-4">
      <MunicipalityCover key={`portada-${slug}`} municipality={municipality} headingRef={headingRef} morphFrom={viaMorph ? morph.rect : null} />
      <QuickFacts key={`datos-${slug}`} municipality={municipality} viaMorph={viaMorph} />

      {/* Desde el hub, el resto espera a que la portada termine de crecer (no se cruza con ella). */}
      <motion.div
        key={`resto-${slug}`}
        className="grid gap-10 max600:gap-8"
        {...(viaMorph && !reduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: entranceDelays(true).facts } } : {})}
      >
      <div className="grid gap-6 md:grid-cols-2">
        <MemoryCard municipality={municipality} />
        <MiniMap municipality={municipality} />
      </div>

      <div className="grid gap-12" aria-busy={state.status === 'loading'}>
        {state.status === 'error' && (
          <div className="rounded-2xl border border-[rgba(216,91,54,.3)] bg-[rgba(216,91,54,.06)] p-6" role="alert">
            <p className="m-0 flex items-center gap-2 text-[16px] font-bold text-[#a8431f]"><Icon name="close" className="size-5" /> No pudimos cargar lo que se teje en {municipality.name}.</p>
            <p className="mt-1 mb-4 text-[15px] text-[#53645c]">Revisa tu conexión e inténtalo de nuevo.</p>
            <button type="button" className={BTN_INK_MD} onClick={retry}>Reintentar</button>
          </div>
        )}
        {state.status === 'loading' && <Skeleton />}
        {ready && (
          <>
            <MunicipalityPublications key={slug} municipality={municipality} publications={state.data.publications || []} user={user} />
            <MunicipalityPeople municipality={municipality} artists={state.data.artists || []} talent={state.data.talent || []} />
          </>
        )}
      </div>

      <OtherMunicipalities current={municipality.slug} />
      </motion.div>
    </div>
  );
}
