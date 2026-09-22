/**
 * MoneystackScreen.jsx — Home del sello Moneystack dentro de TEJIDO.
 *
 * Muestra: artista destacado, último lanzamiento, eventos próximos,
 * y una breve descripción del sello.
 *
 * Ruta: #moneystack
 *
 * Estilos: Tailwind (pantalla piloto). Patrones y trampas: frontend/README.md,
 * secciones "Tailwind" > "Patrones aprendidos (Moneystack)".
 */

import { useState, useEffect } from 'react';
import { BADGE_LIGHT } from '../components/uiStyles.js';

// "moneystack-section" es solo un marcador (sin estilos propios): dispara la regla
// html:has(.moneystack-section) de main.css, que pinta de negro el fondo tras el footer flotante.
const SECTION = 'moneystack-section px-[7vw] py-15 bg-[linear-gradient(180deg,#0a0a0a_0%,#111_50%,#0a0a0a_100%)] text-white';
// h2 globales (main.css) fijan font-size y margin: por eso el "!" en esas dos propiedades.
const SECTION_TITLE = 'mb-6! text-[28px]! font-extrabold text-white';

export default function MoneystackScreen() {
  // Estado para artistas, loading y error
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Si el logo no carga se muestra el texto "MS" en su lugar
  const [logoFailed, setLogoFailed] = useState(false);

  // Cargar artistas al montar el componente
  useEffect(() => {
    fetch('/api/artists')
      .then((res) => {
        if (!res.ok) throw new Error('No fue posible cargar los artistas');
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.artists) ? data.artists : [];
        setArtists(list);
      })
      .catch((err) => {
        console.error('Error loading artists:', err);
        setError('No fue posible cargar los artistas');
        setArtists([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Estado de carga
  if (loading) {
    return (
      <section className={SECTION}>
        <div className="py-20 text-center text-[16px] text-[rgba(255,255,255,0.5)]">Cargando Moneystack...</div>
      </section>
    );
  }

  return (
    <section className={SECTION}>
      {/* Hero del sello */}
      <div className="mx-auto mb-15 flex max-w-[1000px] items-center justify-between gap-10 max768:flex-col-reverse max768:gap-6 max768:text-center">
        <div className="flex-1">
          <span className={BADGE_LIGHT}>Sello Independiente</span>
          {/* h1 global: font-size, margin y letter-spacing con "!" */}
          <h1 className="mt-3! mb-4! text-[length:clamp(48px,6vw,80px)]! font-extrabold tracking-[-0.03em]! bg-[linear-gradient(135deg,#ffffff,#b0b0b0)] bg-clip-text [-webkit-text-fill-color:transparent]">Moneystack</h1>
          <p className="mb-6 max-w-[500px] text-[18px] leading-[1.6] text-[rgba(255,255,255,0.7)] max768:mx-auto max768:mt-0">
            El sello que mueve la cultura del Bajo Cauca.
            Música, eventos y comunidad desde Caucasia, Antioquia.
          </p>
          <div className="flex flex-wrap gap-2.5 max768:justify-center">
            <span className="rounded-[999px] border border-[rgba(255,255,255,0.15)] px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.08em] text-[rgba(255,255,255,0.6)] uppercase">Música Urbana</span>
            <span className="rounded-[999px] border border-[rgba(255,255,255,0.15)] px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.08em] text-[rgba(255,255,255,0.6)] uppercase">Bajo Cauca</span>
            <span className="rounded-[999px] border border-[rgba(255,255,255,0.15)] px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.08em] text-[rgba(255,255,255,0.6)] uppercase">Independiente</span>
          </div>
        </div>

        <div className="flex size-100 shrink-0 items-center justify-center max768:size-25" aria-label="Logo de MoneyStack">
          {logoFailed ? (
            <span className="flex text-[64px] font-extrabold text-white max768:text-[40px]">MS</span>
          ) : (
            <img
              className="size-full object-contain"
              src="/images/moneystack/logo.png"
              alt="Logo de MoneyStack"
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>
      </div>

      {/* Artistas del sello */}
      <div className="mx-auto mb-15 max-w-[1000px]">
        <h2 className={SECTION_TITLE}>Nuestros Artistas</h2>
        {error ? (
          <p className="py-7.5 text-[#ff7a5c]">{error}. Verifica que el backend Python esté activo en el puerto 8765.</p>
        ) : artists.length === 0 ? (
          <p className="text-[rgba(255,255,255,0.4)] italic">Pronto habrá artistas aquí</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {artists.map(artist => (
              // "a" global hereda el color del padre (blanco, de SECTION): no lleva text-white
              <a
                key={artist.id}
                href={`/artistas/${artist.slug || 'og-mauro'}`}
                className="group block overflow-hidden rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] transition-all duration-300 ease-[ease] hover:-translate-y-1 hover:border-[rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.15)]"
              >
                {/* Imagen del artista — usa la imagen real si existe, si no placeholder */}
                <div
                  className="flex h-50 items-center justify-center bg-[linear-gradient(135deg,#262626,#050505)] bg-cover bg-center transition-transform duration-400 ease-[ease] group-hover:scale-[1.06]"
                  style={{
                    backgroundImage: artist.image ? `url(${artist.image})` : undefined,
                  }}
                >
                  {!artist.image && <span className="text-[64px] font-extrabold text-[rgba(255,255,255,0.6)]">{artist.stage_name.charAt(0)}</span>}
                </div>
                <div className="p-5">
                  {artist.genre && (
                    <span className="mb-2 block text-[11px] font-bold tracking-[0.08em] text-[rgba(255,255,255,0.45)] uppercase">{artist.genre.split('/')[0].trim()}</span>
                  )}
                  <h3 className="mb-1! text-[20px]! font-bold">{artist.stage_name}</h3>
                  <p className="mt-0 mb-3 text-[14px] text-[rgba(255,255,255,0.5)]">{artist.name}</p>
                  <span className="flex items-center gap-1.5 border-t border-[rgba(255,255,255,0.08)] pt-3.5 text-[13px] font-semibold text-[rgba(255,255,255,0.7)] transition-[color] duration-200 ease-[ease] group-hover:text-white">
                    Ver perfil <span className="transition-transform duration-250 ease-[ease] group-hover:translate-x-[3px]">→</span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Sobre el sello */}
      <div className="mx-auto max-w-[1000px]">
        <h2 className={SECTION_TITLE}>Sobre el Sello</h2>
        <div className="grid grid-cols-[1fr_1fr] items-start gap-10 max768:grid-cols-[1fr]">
          <p className="text-[16px] leading-[1.7] text-[rgba(255,255,255,0.65)]">
            Moneystack es un sello independiente nacido en Caucasia, Bajo Cauca.
            Nacemos de la necesidad de contar nuestras propias historias a través
            de la música, llevando la esencia del territorio a cada escenario.
          </p>
          <p className="text-[16px] leading-[1.7] text-[rgba(255,255,255,0.65)]">
            Creemos en el talento local, en la música que nace del río y la calle,
            y en la cultura como motor de cambio. Cada canción es un pedazo
            del Bajo Cauca que viaja más allá de sus fronteras.
          </p>
          <div className="flex justify-start gap-8 max768:justify-center">
            <div className="flex flex-col gap-1">
              <span className="text-[28px] font-extrabold text-white">{artists.length}</span>
              <span className="text-[12px] tracking-[0.08em] text-[rgba(255,255,255,0.5)] uppercase">Artista{artists.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[28px] font-extrabold text-white">5+</span>
              <span className="text-[12px] tracking-[0.08em] text-[rgba(255,255,255,0.5)] uppercase">Eventos realizados</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[28px] font-extrabold text-white">Bajo Cauca</span>
              <span className="text-[12px] tracking-[0.08em] text-[rgba(255,255,255,0.5)] uppercase">Territorio</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
