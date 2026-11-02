import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { getInitials } from '../../utils/initials.js';
import SuggestNote from './SuggestNote.jsx';

// Modulo 5: talento y artistas del municipio, en tarjetas horizontales (avatar, texto, boton).
// - Artista: fondo #0d0f0e, avatar dorado con iniciales de tinta (o su foto), "Artista Moneystack"
//   solo si moneystack es true (si no, su genero o "Artista"), "Ver perfil" a #artista/<slug>.
// - Talento: fondo tinta, avatar menta, la categoria cultural en menta, "Explorar" a #talento/<slug>.
// Sin ninguno, Hilo invita a sugerir un talento.
// Contrastes: dorado sobre #0d0f0e 8.7:1; gris 70 % 9.6:1; tinta sobre dorado 5.3:1; menta sobre
// tinta 5.9:1; papel 80 % sobre tinta 7.8:1; tinta sobre menta 5.9:1. El texto del encabezado
// (#7a5c12, ocre oscuro) da 5.9:1 sobre el papel.
const CARD = 'flex min-w-0 items-center gap-4 rounded-2xl p-5 max480:flex-wrap';
const BUTTON = 'ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full py-2 px-5 text-[14px] font-bold no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 max480:ml-20';

function Avatar({ src, name, tone }) {
  return (
    <div className={`flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-[20px] font-extrabold text-ink ${tone}`} aria-hidden="true">
      {src ? <img src={cdnImage(src, { width: 160, fit: 'fill' })} alt="" className="size-full object-cover" loading="lazy" decoding="async" /> : getInitials(name)}
    </div>
  );
}

export default function MunicipalityPeople({ municipality, artists, talent }) {
  const empty = artists.length === 0 && talent.length === 0;
  return (
    <section aria-labelledby="municipio-talento">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="municipio-talento" className="m-0 font-sans text-[length:clamp(28px,3.4vw,40px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-ink">
          Talento y artistas de {municipality.name}
        </h2>
        <p className="m-0 text-[15px] font-semibold text-[#7a5c12]">Con sello Moneystack y gestores locales</p>
      </div>
      {empty ? (
        <div className="mt-6">
          <SuggestNote
            title={`Aún no hay talento ni artistas de ${municipality.name}`}
            text={`¿Conoces a alguien de ${municipality.name} que haga cultura? Cuéntanos quién es y lo invitamos a TEJIDO.`}
            draft={`Quiero sugerir un talento de ${municipality.name}: `}
          />
        </div>
      ) : (
        <ul className="mt-6 grid list-none gap-4 p-0 md:grid-cols-2">
          {artists.map((artist) => (
            <li key={`artista-${artist.slug}`} className={`${CARD} bg-[#0d0f0e]`}>
              <Avatar src={artist.image} name={artist.stage_name} tone="bg-gold" />
              <div className="min-w-0 flex-1 max480:basis-[calc(100%-80px)]">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[.14em] text-gold">
                  {artist.moneystack ? 'Artista Moneystack' : (artist.genre || 'Artista')}
                </p>
                <h3 className="mt-1 mb-0 font-sans text-[20px] font-extrabold leading-[1.2] tracking-[-0.02em] text-white [overflow-wrap:anywhere]">{artist.stage_name}</h3>
                <p className="mt-1 mb-0 text-[14px] text-[rgba(255,255,255,0.7)]">{[artist.genre, municipality.name].filter(Boolean).join(' · ')}</p>
              </div>
              <a href={`#artista/${artist.slug}`} className={`${BUTTON} border border-[rgba(255,255,255,0.4)] bg-[#1c2220] text-white hover:bg-[#2a3330] focus-visible:outline-white`}>
                Ver perfil<span className="sr-only">: {artist.stage_name}</span>
              </a>
            </li>
          ))}
          {talent.map((profile) => (
            <li key={`talento-${profile.slug}`} className={`${CARD} bg-ink`}>
              <Avatar src={profile.cover_url} name={profile.name} tone="bg-[#88c5a4]" />
              <div className="min-w-0 flex-1 max480:basis-[calc(100%-80px)]">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[.14em] text-[#88c5a4]">{profile.category_label || 'Talento'}</p>
                <h3 className="mt-1 mb-0 font-sans text-[20px] font-extrabold leading-[1.2] tracking-[-0.02em] text-paper [overflow-wrap:anywhere]">{profile.name}</h3>
                {profile.tagline && <p className="mt-1 mb-0 text-[14px] text-[rgba(253,251,247,0.8)]">{profile.tagline}</p>}
              </div>
              <a href={`#talento/${profile.slug}`} className={`${BUTTON} bg-gold text-ink hover:bg-yellow focus-visible:outline-paper`}>
                Explorar<span className="sr-only">: {profile.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
