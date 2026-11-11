import { useState } from 'react';
import { TS } from '../territory/territoryStyles.js';
import { cdnImage } from '../../utils/cloudinaryUrl.js';
import { getInitials } from '../../utils/initials.js';
import { MUNICIPALITY_NAMES, SELLOS, selloOf } from '../../utils/artists.js';

// Tarjeta de un artista (#artistas, rama Musica, municipio): foto, nombre artistico, genero, municipio y
// el chip de su sello. Toda la tarjeta es un enlace a su perfil (#artista/<slug>). Estetica de Agenda y
// Oportunidades (components/territory), sin degradados. layout="row": horizontal y compacta.
// Contrastes del chip: TEJIDO tinta sobre crema 9,3:1; Moneystack crema sobre negro #0d0f0e 17,4:1.
const CHIP = {
  tejido: 'border-[#173f36] bg-[#f3e4c8] text-[#173f36]',
  moneystack: 'border-[#0d0f0e] bg-[#0d0f0e] text-[#fff9ec]',
};

export function SelloChip({ artist, className = '' }) {
  const sello = selloOf(artist);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold uppercase leading-[1.4] tracking-[.12em] ${CHIP[sello]} ${className}`}
      data-sello={sello}>
      <span className="sr-only">Sello: </span>{SELLOS[sello].label}
    </span>
  );
}

function Photo({ artist, className }) {
  const [failed, setFailed] = useState(false);
  if (artist.image && !failed) {
    return <img src={cdnImage(artist.image, { width: 640 })} alt={`Foto de ${artist.stage_name}`} loading="lazy" decoding="async"
      className={`block object-cover ${className}`} onError={() => setFailed(true)} />;
  }
  return (
    <span className={`flex items-center justify-center bg-[#f3e4c8] font-sans text-[34px] font-extrabold text-[#173f36] ${className}`} aria-hidden="true">
      {getInitials(artist.stage_name)}
    </span>
  );
}

export default function ArtistCard({ artist, layout = 'grid' }) {
  const place = MUNICIPALITY_NAMES[artist.municipality];
  const meta = [artist.genre, place].filter(Boolean).join(' · ');
  if (layout === 'row') {
    return (
      <a href={`#artista/${artist.slug}`} className={`${TS.card} ${TS.cardHover} ${TS.focus} flex-row items-center gap-4 p-4`} data-artista={artist.slug}>
        <Photo artist={artist} className="size-16 shrink-0 rounded-full text-[20px]" />
        <span className="grid min-w-0 gap-1">
          <SelloChip artist={artist} className="justify-self-start" />
          <span className="font-sans text-[19px] font-extrabold leading-[1.2] [overflow-wrap:anywhere]">{artist.stage_name}</span>
          {meta && <span className="text-[15px] text-[#3f514a]">{meta}</span>}
        </span>
      </a>
    );
  }
  return (
    <a href={`#artista/${artist.slug}`} className={`${TS.card} ${TS.cardHover} ${TS.focus}`} data-artista={artist.slug}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f3e4c8]">
        <Photo artist={artist} className="size-full" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5 max-[1023px]:p-4">
        <SelloChip artist={artist} className="self-start" />
        <h3 className="m-0 font-sans text-[21px] font-extrabold leading-[1.2] tracking-[-0.01em] [overflow-wrap:anywhere] max-[1023px]:text-[19px]">{artist.stage_name}</h3>
        {meta && <p className="m-0 text-[15px] font-semibold leading-[1.4] text-[#3f514a]">{meta}</p>}
      </div>
    </a>
  );
}
