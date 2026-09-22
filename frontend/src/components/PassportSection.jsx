/**
 * PASSPORTSECTION.JSX — Pasaporte del Territorio
 *
 * Componente visual que muestra los sellos de los 6 municipios
 * del Bajo Cauca que el usuario ha coleccionado.
 *
 * Cada sello:
 * - Se ilumina cuando el usuario ha interactuado con contenido de ese municipio
 * - Muestra un emoji y nombre
 * - Tiene una animación de "stamping" cuando se desbloquea
 *
 * Cuando se completan los 6 sellos:
 * - Se muestra un badge "Ciudadano del Bajo Cauca"
 * - Se activa una animación de celebración
 *
 * Los sellos se persisten en localStorage.
 *
 * Parte de la FASE 5 del plan de magia.
 */

import { useState, useEffect } from 'react';
import {
  MUNICIPALITIES,
  loadPassport,
  getPassportProgress,
} from '../utils/passportUtils.js';
import { BADGE, SECTION_TITLE } from './uiStyles.js';

// Sello: base comun y un estado excluyente (borde, fondo y sombra no compiten entre clases).
const STAMP = 'items-center border-2 border-solid rounded-[20px] flex flex-col gap-1.5 py-6 px-4 text-center transition-all duration-300 ease-[ease] max600:py-[18px] max600:px-3';
const STAMP_COLLECTED = 'bg-[rgba(29,143,163,0.06)] border-[var(--stamp-color,#1d8fa3)] [box-shadow:0_4px_20px_rgba(29,143,163,0.12)] animate-[stampAppear_0.5s_ease_backwards]';
const STAMP_LOCKED = 'bg-[rgba(102,116,111,0.04)] border-[rgba(23,58,49,0.08)] opacity-50';

export default function PassportSection() {
  /** Pasaporte actual (municipios visitados) */
  const [passport, setPassport] = useState({});
  /** Progreso del pasaporte */
  const [progress, setProgress] = useState({ collected: 0, total: 6, percentage: 0, isComplete: false });

  // Cargar pasaporte al montar
  useEffect(() => {
    setPassport(loadPassport());
    setProgress(getPassportProgress());
  }, []);

  return (
    <section className="max-w-[900px] my-0 mx-auto">
      {/* Encabezado del pasaporte */}
      <div className="text-center mb-[30px]">
        <span className={BADGE}>Pasaporte</span>
        <h2 className={SECTION_TITLE}>Tu recorrido por el Bajo Cauca</h2>
        <p className="text-muted text-[16px] leading-[1.5] mt-2">
          Colecciona sellos de cada municipio explorando contenido de TEJIDO.
        </p>
      </div>

      {/* Barra de progreso */}
      <div className="flex items-center gap-3.5 mb-[30px]">
        <div className="flex-1 bg-[rgba(23,58,49,0.08)] rounded-[999px] h-2 overflow-hidden">
          <div
            className="bg-[linear-gradient(90deg,#1d8fa3,#d4a843)] rounded-[999px] h-full transition-[width] duration-600 ease-[ease]"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <span className="text-muted text-[13px] font-semibold whitespace-nowrap">
          {progress.collected} de {progress.total} municipios
        </span>
      </div>

      {/* Grid de sellos */}
      <div className="grid gap-4 grid-cols-[repeat(3,1fr)] max600:grid-cols-[repeat(2,1fr)]">
        {MUNICIPALITIES.map((muni) => {
          const isCollected = !!passport[muni.id];
          return (
            <div
              key={muni.id}
              className={`${STAMP} ${isCollected ? STAMP_COLLECTED : STAMP_LOCKED}`}
              style={{
                '--stamp-color': muni.color,
                animationDelay: `${MUNICIPALITIES.indexOf(muni) * 0.1}s`,
              }}
            >
              {/* Emoji del municipio */}
              <span className="text-[32px] leading-none max600:text-[26px]">{muni.emoji}</span>
              {/* Nombre */}
              <span className="text-[14px] font-bold text-ink">{muni.name}</span>
              {/* Tema */}
              <span className="text-muted text-[11px]">{muni.theme}</span>
              {/* Indicador de estado */}
              <span className={`text-[16px] mt-1 ${isCollected ? 'text-[#16a085]' : 'text-muted'}`}>
                {isCollected ? '\u2713' : '\u25CB'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Badge de completado */}
      {progress.isComplete && (
        <div className="items-center bg-[linear-gradient(135deg,rgba(212,168,67,0.1),rgba(29,143,163,0.1))] border-2 border-solid border-[#d4a843] rounded-[24px] flex flex-col gap-2 mt-[30px] p-[30px] text-center animate-[badgeGlow_2s_ease-in-out_infinite]">
          <span className="text-[48px]">{'\uD83C\uDFC6'}</span>
          <h3 className="font-sans tracking-[-.055em] text-[#d4a843] text-[22px] m-0">Ciudadano del Bajo Cauca</h3>
          <p className="text-muted text-[14px] leading-[1.5] m-0 max-w-[400px]">Has explorado los 6 municipios. Tu conocimiento del territorio es completo.</p>
        </div>
      )}

      {/* Mensaje motivacional cuando está incompleto */}
      {!progress.isComplete && progress.collected > 0 && (
        <p className="text-muted text-[14px] text-center mt-5">
          {progress.collected === 1
            ? 'Buen comienzo. Sigue explorando para completar tu pasaporte.'
            : `Llevas ${progress.collected} sellos. ${6 - progress.collected} municipios por descubrir.`}
        </p>
      )}
    </section>
  );
}
