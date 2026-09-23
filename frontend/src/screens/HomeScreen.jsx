import HeroInteractive from '../components/HeroInteractive.jsx';
import PassportSection from '../components/PassportSection.jsx';
import TimelineSection from '../components/TimelineSection.jsx';
import HomeFeaturedArtist from './HomeFeaturedArtist.jsx';
import HomeMapSection from './HomeMapSection.jsx';
import { BTN_CULTURAL, BTN_CULTURAL_BASE, SECTION } from '../components/uiStyles.js';

// En la invitacion (fondo naranja) el boton cultural va en blanco; el de contorno es propio de aqui.
const BTN_INVITE = `${BTN_CULTURAL_BASE} bg-white text-sunset hover:bg-ink-deep hover:text-white`;
const BTN_OUTLINE = 'bg-transparent border-2 border-solid border-white rounded-[999px] text-white cursor-pointer font-bold py-3.5 px-[30px] transition-all duration-300 ease-[ease] no-underline hover:bg-white hover:text-sunset';

export default function HomeScreen({ onExplore, publications = [] }) {
  return (
    <>
      <HeroInteractive onExplore={onExplore} publications={publications} />

      <HomeFeaturedArtist />

      <HomeMapSection publications={publications} />

      <section className={SECTION}>
        <PassportSection />
      </section>

      {/* Bloque oscuro propio: si no hay publicaciones con fecha, no deja una caja vacia. */}
      <TimelineSection publications={publications} />

      <section className="bg-[linear-gradient(135deg,var(--sunset)_0%,var(--gold)_100%)] mt-[60px] mx-[4vw] mb-0 py-[100px] px-[8vw] rounded-[40px] text-center">
        <div className="max-w-[600px] my-0 mx-auto">
          <h2 className="font-sans leading-[.98] text-white text-[length:clamp(40px,5vw,64px)] font-extrabold tracking-[-0.05em] mt-0 mx-0 mb-5">¿Listo para <em className="font-display italic underline underline-offset-8">tejer</em> historia?</h2>
          <p className="text-[rgba(255,255,255,0.9)] text-[18px] leading-[1.7] mt-0 mx-0 mb-8">
            Únete a la comunidad que construye el futuro del Bajo Cauca.
            Comparte, descubre, participa.
          </p>

          <div className="flex gap-3 justify-center mb-10">
            <input
              type="email"
              className="py-3.5 px-5 border-2 border-solid border-[rgba(255,255,255,0.3)] rounded-[999px] bg-[rgba(255,255,255,0.15)] text-white text-[14px] w-[280px] backdrop-blur-[10px] placeholder:text-[rgba(255,255,255,0.7)] focus:outline-none focus:border-white focus:bg-[rgba(255,255,255,0.25)]"
              placeholder="Tu correo electrónico"
            />
            <button className={BTN_CULTURAL} type="button">
              Quiero Participar
            </button>
          </div>

          <div className="flex gap-4 justify-center max768:flex-col">
            <button className={BTN_INVITE} type="button" onClick={onExplore}>
              Comenzar Ahora
            </button>
            <a className={BTN_OUTLINE} href="#mapa">
              Ver Mapa
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
