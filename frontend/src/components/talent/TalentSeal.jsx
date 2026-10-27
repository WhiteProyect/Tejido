// Sello dorado de "Verificado por Tejido": roseta festoneada con anillo y check, en colores
// solidos (sin degradado). Decorativo: el texto del sello va siempre al lado (etiqueta o
// insignia), asi que aqui se oculta a lectores de pantalla.
const POINTS = 28;
const ROSETTE = Array.from({ length: POINTS * 2 }, (_, i) => {
  const angle = (Math.PI * i) / POINTS - Math.PI / 2;
  const radius = i % 2 === 0 ? 24 : 21.6;
  return `${(24 + radius * Math.cos(angle)).toFixed(2)},${(24 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(' ');

export default function TalentSeal({ className = 'size-11' }) {
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 drop-shadow-[0_3px_6px_rgba(12,36,30,.25)] ${className}`} aria-hidden="true">
      <polygon points={ROSETTE} fill="#d4a843" stroke="#b8862f" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="16.5" fill="#e2bd5f" stroke="#fff3d1" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="13.5" fill="none" stroke="#b8862f" strokeWidth="0.8" strokeDasharray="1.6 1.6" />
      <path d="m17.5 24.5 4.5 4.5 8.5-9" fill="none" stroke="#6b4e0e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
