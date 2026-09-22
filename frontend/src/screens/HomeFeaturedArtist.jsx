import { useState, useEffect } from 'react';
import { BADGE_LIGHT } from '../components/uiStyles.js';

// Tarjeta oscura del artista destacado. Clases repetidas del reproductor y los iconos sociales.
const PLAY_BTN = 'w-12 h-12 bg-gold border-none rounded-[50%] cursor-pointer flex items-center justify-center transition-all duration-300 ease-[ease] shrink-0 hover:[transform:scale(1.1)] hover:[box-shadow:0_8px_24px_rgba(212,168,67,0.4)]';
const PLAY_ICON = 'w-5 h-5 text-white ml-[3px]';
const SOCIAL_LINK = 'w-11 h-11 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[12px] flex items-center justify-center transition-all duration-300 ease-[ease] hover:bg-gold hover:border-gold hover:[transform:translateY(-3px)]';
const SOCIAL_ICON = 'w-5 h-5 text-white';
const TAG = 'bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-[999px] text-white text-[12px] font-semibold tracking-[0.05em] py-2 px-4 uppercase';

export default function HomeFeaturedArtist() {
  const [artistData, setArtistData] = useState(null);

  useEffect(() => {
    fetch('/api/artists/home')
      .then(res => res.json())
      .then(data => {
        if (data.artist) setArtistData(data);
      })
      .catch(() => {});
  }, []);

  if (!artistData || !artistData.artist) return null;

  const { artist, featured_track } = artistData;

  return (
    <section className="bg-[#0a0a0a] text-white grid grid-cols-[1fr_1fr] gap-20 my-0 mx-[4vw] py-[100px] px-[8vw] rounded-[40px] relative overflow-hidden max1024:grid-cols-[1fr] max1024:gap-12 max1024:py-20 max1024:px-[6vw]">
      <div className="relative z-2">
        <span className={BADGE_LIGHT}>Artista Destacado</span>
        <h2 className="font-sans leading-[.98] text-[length:clamp(48px,5.5vw,76px)] font-extrabold tracking-[-0.05em] mt-0 mx-0 mb-6">{artist.stage_name}</h2>
        <p className="text-[rgba(255,255,255,0.8)] text-[18px] leading-[1.7] mt-0 mx-0 mb-8 max-w-[480px]">{artist.bio}</p>
        <div className="flex gap-3 flex-wrap">
          <span className={TAG}>Moneystack</span>
          <span className={TAG}>Bajo Cauca</span>
          <span className={TAG}>Música Urbana</span>
        </div>

        {featured_track && (
          <div className="my-6 mx-0">
            <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-4">
              {featured_track.spotify_url ? (
                <a href={featured_track.spotify_url} target="_blank" rel="noopener noreferrer" className={PLAY_BTN} aria-label="Escuchar en Spotify">
                  <svg className={PLAY_ICON} viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </a>
              ) : featured_track.youtube_url ? (
                <a href={featured_track.youtube_url} target="_blank" rel="noopener noreferrer" className={PLAY_BTN} aria-label="Ver en YouTube">
                  <svg className={PLAY_ICON} viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </a>
              ) : (
                <button className={PLAY_BTN} type="button" disabled>
                  <svg className={PLAY_ICON} viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </button>
              )}
              <div className="flex-1">
                <span className="text-[14px] font-semibold mb-2 block">{featured_track.title}</span>
                <div className="h-1 bg-[rgba(255,255,255,0.2)] rounded-[2px] mb-1.5 overflow-hidden">
                  <div className="h-full w-[36%] bg-gold rounded-[2px]"></div>
                </div>
                <span className="text-[11px] text-[rgba(255,255,255,0.5)]">{featured_track.duration}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          {artist.instagram_url && (
            <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK} aria-label="Instagram">
              <svg className={SOCIAL_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
          )}
          {artist.youtube_url && (
            <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK} aria-label="YouTube">
              <svg className={SOCIAL_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
              </svg>
            </a>
          )}
          {artist.spotify_url && (
            <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK} aria-label="Spotify">
              <svg className={SOCIAL_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 15s4-1 6-2"/>
                <path d="M7 12s5-1.5 7.5-2.5"/>
                <path d="M6.5 9S12 7 17 9"/>
              </svg>
            </a>
          )}
        </div>

        <div className="bg-[linear-gradient(135deg,rgba(212,168,67,0.15)_0%,rgba(232,93,58,0.1)_100%)] border border-[rgba(212,168,67,0.3)] rounded-[16px] py-4 px-5">
          <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-gold block mb-1.5">Sello Independiente</span>
          <a href="#moneystack" className="text-[20px] font-extrabold block mb-1">Moneystack</a>
          <span className="text-[13px] text-[rgba(255,255,255,0.7)]">Bajo Cauca Antioqueño</span>
        </div>
      </div>
      <div className="items-center flex flex-col gap-6 justify-center max1024:[order:-1]">
        <div className="relative">
          {artist.image ? (
            <img src={artist.image} alt={artist.stage_name} className="w-full h-full object-cover rounded-[28px]" />
          ) : (
            <div className="bg-[linear-gradient(135deg,var(--gold)_0%,var(--sunset)_100%)] rounded-[28px] h-[420px] w-[420px] flex items-center justify-center [box-shadow:0_32px_80px_rgba(212,168,67,0.25)]">
              <span className="text-white text-[100px] font-extrabold tracking-[-0.05em]">{artist.stage_name.charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="text-center">
          <span className="text-[rgba(255,255,255,0.6)] text-[14px] font-bold tracking-[0.2em] uppercase">Moneystack</span>
        </div>
      </div>
    </section>
  );
}
