import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import Icon from '../Icon.jsx';
import ShareMenu from '../ShareMenu.jsx';
import AvailabilityCalendar from './AvailabilityCalendar.jsx';
import Endorsements from './Endorsements.jsx';
import InfoCard from './InfoCard.jsx';
import Modal from './Modal.jsx';
import Portfolio from './Portfolio.jsx';
import { ServicesList, SpecsList } from './ServicesList.jsx';
import TalentCard from './TalentCard.jsx';
import TalentSeal from './TalentSeal.jsx';
import Trajectory from './Trajectory.jsx';
import VenuesMap from './VenuesMap.jsx';
import { META, SECTION_LABEL, useIsMobile } from './talentUi.js';
import { BTN_INK_MD } from '../uiStyles.js';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { CATEGORY_BY_KEY, canSave, categoryColor, categoryOrigin, categoryTint, formatCOP, initials, talentShareUrl, useTalentFavorite } from '../../utils/talent.js';

// Presentacion del perfil de un talento: la usan la pagina publica (screens/TalentProfileScreen,
// GET /api/talent/{slug}) y la vista previa (screens/TalentPreviewScreen, GET /api/talent/manage/{id}).
// Cada seccion se omite si no tiene contenido (menos la cabecera). "Contratar" solo avisa que viene
// pronto (no recoge datos ni redirige); "Agregar a mi agenda" guarda el talento (solo visitantes,
// que van a login, y ciudadanos). Escritorio: foto grande y tarjeta de papel con los datos; Hilo
// junto a "Respaldo". Movil: foto panoramica con el sello y la capsula de verificacion, acordeones,
// mapa y una barra fija con el precio minimo y "Contratar" (el body reserva su alto para no tapar
// el pie). preview: sin guardar ni compartir (y sin "Talento parecido", que la vista previa no trae).
const CONTRATAR = 'inline-flex items-center justify-center rounded-full border-0 bg-orange py-2 px-6 text-[19px] font-bold text-white cursor-pointer transition-colors duration-200 hover:bg-[#c04c2a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink';
const AGENDA = 'inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-solid py-[8px] px-4 text-[15px] font-semibold cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait';
const BAR_HEIGHT = 76;

function Cover({ talent, className }) {
  if (talent.cover_url) {
    return <img src={cdnImage(talent.cover_url, { width: 1600 })} alt={`Foto de ${talent.name}`} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ backgroundColor: categoryTint(talent.category) }} role="img" aria-label={`${talent.name}, sin foto de portada`}>
      <span className="font-display text-[96px] font-bold italic" style={{ color: categoryColor(talent.category) }} aria-hidden="true">{initials(talent.name)}</span>
    </div>
  );
}

function VerifiedBadge({ talent }) {
  return (
    <p className="m-0 inline-flex items-center gap-2 rounded-[5px] border-[1.5px] border-dashed border-gold bg-[#fffaf0] py-1 pr-3 pl-1.5 text-[15px] font-semibold text-[#7a5c12]">
      <TalentSeal className="size-6" />
      Verificado por Tejido · Acta {talent.act_number}
    </p>
  );
}

function AgendaButton({ talent, user }) {
  const { favorite, busy, toggle } = useTalentFavorite(talent, user, { returnTo: `talento/${talent.slug}` });
  if (!canSave(user)) return null;
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={favorite}
      className={`${AGENDA} ${favorite ? 'border-ink bg-ink text-white hover:bg-[#24574b]' : 'border-ink bg-transparent text-ink hover:bg-ink hover:text-white'}`}>
      {favorite && <Icon name="bookmark" className="size-4 fill-current" />}
      {favorite ? 'Guardado en mi agenda' : 'Agregar a mi agenda'}
    </button>
  );
}

function Share({ talent, menuAlign }) {
  return <ShareMenu url={talentShareUrl(talent.slug)} text={`${talent.name} - Talento del Bajo Cauca en TEJIDO`} menuUp={false} menuAlign={menuAlign} />;
}

function Breadcrumbs({ talent }) {
  const category = CATEGORY_BY_KEY[talent.category];
  const LINK = 'text-[#3f514a] no-underline hover:text-ink hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
  const sep = (
    <li aria-hidden="true" className="text-[#6c756f]">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
    </li>
  );
  return (
    <nav aria-label="Ruta de navegación" className="block">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-[14px] text-[#3f514a]">
        <li><a className={LINK} href="#inicio">Inicio</a></li>
        {sep}
        <li><a className={LINK} href="#talento">Talento</a></li>
        {category && <>{sep}<li><a className={LINK} href={`#talento?cat=${category.slug}`}>{category.label}</a></li></>}
        {sep}
        <li aria-current="page" className="font-semibold text-ink [overflow-wrap:anywhere]">{talent.name}</li>
      </ol>
    </nav>
  );
}

function Section({ id, label, children, top = 'mt-12' }) {
  return (
    <section className={top} aria-labelledby={id}>
      <h2 id={id} tabIndex={-1} className={`${SECTION_LABEL} mb-4 focus:outline-none`}>{label}</h2>
      {children}
    </section>
  );
}

// Hilo (version liviana .webp) con su burbuja: lleva a "Talento parecido".
function HiloHint({ targetId, className = '' }) {
  const reduceMotion = useReducedMotion();
  function go() {
    const heading = document.getElementById(targetId);
    heading?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    heading?.focus({ preventScroll: true });
  }
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <button type="button" onClick={go}
        className="relative mb-1 max-w-[190px] cursor-pointer rounded-[16px] border border-[#cdbd9e] bg-[#fffdf8] py-2 px-3.5 text-center text-[14px] font-semibold leading-[1.3] text-ink [box-shadow:0_8px_20px_rgba(23,58,49,.12)] after:absolute after:-bottom-[7px] after:left-1/2 after:size-3 after:-translate-x-1/2 after:rotate-45 after:border-r after:border-b after:border-[#cdbd9e] after:bg-[#fffdf8] after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        ¿Quieres ver talento parecido cerca de aquí?
      </button>
      <img src="/images/hilo/hilo-saluda.webp" alt="" width="150" height="145" loading="lazy" className="mt-1 h-auto w-[150px]" />
    </div>
  );
}

function MobileBar({ talent, onHire }) {
  useEffect(() => {
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `${BAR_HEIGHT}px`;
    return () => { document.body.style.paddingBottom = previous; };
  }, []);
  const hasPrice = talent.price_from !== null && talent.price_from !== undefined;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center gap-3 border-t border-t-[#e3d6bf] bg-[#fffaf0] py-3 px-4 [box-shadow:0_-8px_24px_rgba(12,36,30,.08)]" style={{ minHeight: BAR_HEIGHT }}>
      {hasPrice && (
        <p className="m-0 min-w-0 flex-1 whitespace-nowrap text-[15px] leading-[1.3] text-ink">
          Desde <strong className="text-[18px]">{formatCOP(talent.price_from)}</strong> / sesión
        </p>
      )}
      <button type="button" className={`${CONTRATAR} ${hasPrice ? '' : 'flex-1'}`} onClick={onHire}>Contratar</button>
    </div>
  );
}


export default function TalentProfileView({ talent, user, preview = false }) {
  const mobile = useIsMobile();
  const [hiring, setHiring] = useState(false);
  const meta = categoryOrigin(talent);
  const openHire = () => setHiring(true);
  const similar = talent.similar || [];
  const services = talent.services.length;
  const cards = [
    services > 0 && (
      <InfoCard key="services" label="Qué ofrece" hint={`(${services} ${services === 1 ? 'servicio' : 'servicios'})`} mobile={mobile}>
        <ServicesList services={talent.services} />
      </InfoCard>
    ),
    talent.specs.length > 0 && <InfoCard key="specs" label="Ficha técnica" mobile={mobile}><SpecsList specs={talent.specs} /></InfoCard>,
    talent.availability.length > 0 && (
      <InfoCard key="availability" label="Disponibilidad" mobile={mobile}><AvailabilityCalendar availability={talent.availability} name={talent.name} /></InfoCard>
    ),
  ].filter(Boolean);

  const venues = talent.venues.length > 0 && (
    <Section id="talento-lugares" label="Dónde se ha presentado" top={mobile ? 'mt-6' : 'mt-12'}>
      <VenuesMap origin={talent.origin} venues={talent.venues} name={talent.name} />
    </Section>
  );
  const hasSimilar = similar.length > 0;
  const hasHistory = talent.milestones.length > 0 || Boolean(talent.description);

  return (
    <article className="min-h-[62vh] pt-[28px] pb-[90px] px-[6vw] max768:pt-5">
      <div className="mx-auto max-w-[1100px]">
        <Breadcrumbs talent={talent} />

        {mobile ? (
          <header className="mt-4">
            <div className="relative">
              <Cover talent={talent} className="aspect-[21/8] w-full rounded-[14px]" />
              {talent.verified && (
                <div className="absolute -bottom-6 left-2 right-2 flex items-center">
                  <TalentSeal className="relative z-[1] size-[60px]" />
                  <p className="m-0 -ml-5 min-w-0 rounded-r-full rounded-l-[6px] bg-gold py-1.5 pr-4 pl-7 text-[15px] font-bold text-ink-deep [box-shadow:0_4px_10px_rgba(12,36,30,.18)]">
                    Verificado por Tejido · Acta {talent.act_number}
                  </p>
                </div>
              )}
            </div>
            <h1 className={`${talent.verified ? 'mt-10' : 'mt-5'} mb-0 text-center font-sans text-[30px] font-extrabold leading-[1.1] tracking-[-.03em] text-ink [overflow-wrap:anywhere]`}>{talent.name}</h1>
            <p className={`${META} mt-1.5 text-center text-ink`}>{meta}</p>
            {talent.tagline && <p className="mt-3.5 mb-0 text-[17px] leading-[1.45] text-ink">{talent.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {!preview && <AgendaButton talent={talent} user={user} />}
              {!preview && <Share talent={talent} menuAlign="left" />}
            </div>
          </header>
        ) : (
          <header className="mt-4 grid grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] items-stretch gap-4 max1024:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="relative min-h-[400px]">
              <Cover talent={talent} className="absolute inset-0 size-full rounded-[14px]" />
            </div>
            <div className="relative flex flex-col justify-center rounded-[4px] border border-[#e3d6bf] bg-[#f8efdd] p-7 [box-shadow:0_14px_30px_rgba(12,36,30,.16)] max1024:p-6">
              {!preview && <div className="absolute right-4 top-4"><Share talent={talent} menuAlign="right" /></div>}
              <p className={`${META} pr-10`}>{meta}</p>
              <h1 className="mt-3 mb-0 font-sans text-[length:clamp(32px,3.4vw,46px)] font-extrabold leading-[1.08] tracking-[-.035em] text-ink [overflow-wrap:anywhere]">{talent.name}</h1>
              {talent.verified && <div className="mt-4"><VerifiedBadge talent={talent} /></div>}
              {talent.tagline && <p className="mt-4 mb-0 text-[17px] leading-[1.5] text-ink">{talent.tagline}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <button type="button" className={CONTRATAR} onClick={openHire}>Contratar</button>
                {!preview && <AgendaButton talent={talent} user={user} />}
              </div>
            </div>
          </header>
        )}

        {cards.length > 0 && (
          <div className={mobile ? 'mt-5 grid gap-2' : `mt-8 grid items-start gap-5 ${cards.length === 3 ? 'grid-cols-[repeat(3,minmax(0,1fr))] max1024:grid-cols-[repeat(2,minmax(0,1fr))]' : 'grid-cols-[repeat(2,minmax(0,1fr))]'}`}>
            {cards}
          </div>
        )}

        {mobile && venues}

        {talent.media.length > 0 && (
          <Section id="talento-portafolio" label="Portafolio">
            <Portfolio media={talent.media} category={talent.category} name={talent.name} />
          </Section>
        )}

        {hasHistory && (
          <Section id="talento-trayectoria" label="Historia / Trayectoria">
            <Trajectory milestones={talent.milestones} description={talent.description} mobile={mobile} />
          </Section>
        )}

        {talent.endorsements.length > 0 && (
          <Section id="talento-respaldo" label="Respaldo">
            <div className={hasSimilar && !mobile ? 'grid grid-cols-[minmax(0,1fr)_190px] items-end gap-6' : ''}>
              <Endorsements endorsements={talent.endorsements} />
              {hasSimilar && !mobile && <HiloHint targetId="talento-parecido" />}
            </div>
          </Section>
        )}

        {!mobile && venues}

        {hasSimilar && (
          <>
            {(mobile || talent.endorsements.length === 0) && <HiloHint targetId="talento-parecido" className="mt-10" />}
            <Section id="talento-parecido" label="Talento parecido" top={mobile || talent.endorsements.length === 0 ? 'mt-6' : 'mt-12'}>
              <ul className="m-0 grid list-none grid-cols-[repeat(3,minmax(0,1fr))] gap-5 p-0 max900:grid-cols-[repeat(2,minmax(0,1fr))] max600:grid-cols-[minmax(0,1fr)]">
                {similar.map((item) => (
                  <li key={item.id} className="flex min-w-0"><TalentCard talent={item} user={user} /></li>
                ))}
              </ul>
            </Section>
          </>
        )}
      </div>

      {mobile && <MobileBar talent={talent} onHire={openHire} />}

      {hiring && (
        <Modal title="Contratar" closeIcon={false} onClose={() => setHiring(false)}>
          <p className="mt-4 mb-0 text-[17px] leading-[1.6] text-[#3f514a]">Muy pronto podrás contratar directo desde TEJIDO.</p>
          <div className="mt-7 flex justify-end">
            <button type="button" className={BTN_INK_MD} onClick={() => setHiring(false)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </article>
  );
}
