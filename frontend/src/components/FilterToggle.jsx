// Filtro en pildoras (Bandeja del admin y Solicitudes del lider). options: [[id, texto], ...].
export default function FilterToggle({ value, onChange, label, options = [['pending', 'Pendientes'], ['all', 'Todos']] }) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-cream p-1" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          className={`cursor-pointer rounded-full border-0 py-1.5 px-3.5 text-[13px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${value === id ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-[rgba(23,63,54,.08)]'}`}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
