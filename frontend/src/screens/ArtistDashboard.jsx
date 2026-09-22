import { useState, useEffect } from 'react';
import { fetchArtistDashboard } from '../services/artistApi.js';

const menuItems = [
  { id: 'overview', label: 'Vista General', icon: '◉' },
  { id: 'music', label: 'Mi Musica', icon: '♫' },
  { id: 'content', label: 'Mi Contenido', icon: '□' },
  { id: 'events', label: 'Mis Eventos', icon: '◈' },
  { id: 'brand', label: 'Mi Marca', icon: '◆' },
  { id: 'stats', label: 'Mis Estadisticas', icon: '▤' },
  { id: 'goals', label: 'Mis Objetivos', icon: '◎' },
];

const releases = [
  { title: 'Sustancias', type: 'Single', date: 'Mar 2024' },
  { title: 'Bajo Cauca', type: 'Single', date: 'Ago 2024' },
  { title: 'Rio Cauca', type: 'Single', date: 'Feb 2025' },
  { title: 'Calle y Cultura', type: 'EP', date: 'Sep 2025' },
  { title: 'Territorio', type: 'Single', date: 'Abr 2026' },
];

const activity = [
  { dot: 'bg-[#00ff88]', text: 'Nuevo lanzamiento: Territorio', date: 'Abr 2026' },
  { dot: 'bg-[#3B82F6]', text: 'Presentacion en Festival Rio y Sabana', date: 'Jul 2026' },
  { dot: 'bg-[#d4a843]', text: '10,000 reproducciones en Sustancias', date: 'Mar 2024' },
];

const stats = [
  { label: 'Reproducciones este mes', value: '12,500', change: '+12% vs mes anterior', up: true },
  { label: 'Tasa de retencion', value: '68%', change: '+3% vs mes anterior', up: true },
  { label: 'Guardados en playlists', value: '245', change: '+18% vs mes anterior', up: true },
  { label: 'Alcance en redes', value: '34,200', change: '-2% vs mes anterior', up: false },
];

// Clases repetidas del dashboard (paleta propia verde-negro, sin tokens de marca).
const MS_CARD = 'bg-[#111] border border-[#1a1a1a] rounded-[12px] flex flex-col gap-2';
const MS_CONTENT = 'p-8 flex-1 max768:p-5';
// Los h1-h3 conservan su etiqueta: la regla global fija font-size y margin, de ahi los `!`.
const MS_SECTION_TITLE = "text-[16px]! font-bold text-white mt-0 mx-0 mb-5! font-sans flex items-center gap-2.5 before:content-[''] before:w-[3px] before:h-[18px] before:bg-[#00ff88] before:rounded-[2px]";
// En movil la tabla solo muestra Titulo y Tipo (el legado ocultaba los span 3 y 4).
const MS_TABLE_GRID = 'grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 py-3.5 px-5 max768:grid-cols-[1fr_1fr] max768:[&>span:nth-child(n+3)]:hidden';
// Los `!` ganan a `button { font: inherit }` de main.css. Los hover van en la base: en el
// legado `.ms-nav-item:hover` era mas especifico que `--active` y tambien lo pisaba.
const MS_NAV_ITEM = 'flex items-center gap-3 py-2.5 px-3 border-none cursor-pointer rounded-[8px] transition-all duration-200 ease-[ease] text-left text-[13px]! font-semibold! font-sans! hover:text-[#ccc] hover:bg-[rgba(255,255,255,0.04)]';

function MetricCard({ label, value, suffix, trend }) {
  return (
    <div className={`${MS_CARD} p-5`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#555]">{label}</span>
      <span className="text-[28px] font-extrabold text-white font-sans">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span className="text-[14px] text-[#555] font-normal">{suffix}</span>}
      </span>
      {trend && (
        <span className={`text-[12px] font-bold ${trend > 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  );
}

function ProgressBar({ label, current, target, color }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-[13px] text-[#888]">{label}</span>
        <span className="text-[12px] text-[#555] font-semibold">{current} / {target}</span>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-[3px] overflow-hidden">
        <div className="h-full rounded-[3px] transition-[width] duration-800 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function ArtistDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchArtistDashboard(1)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
        <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-[#00ff88] rounded-[50%] animate-[msSpin_0.6s_linear_infinite]" />
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  const latest = data?.latest || {};

  return (
    <div className="grid grid-cols-[260px_1fr] min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-['JetBrains_Mono','DM_Sans',monospace,sans-serif] max768:grid-cols-[1fr]">
      <aside className="bg-[#0f0f0f] border-r border-r-[#1a1a1a] flex flex-col py-6 sticky top-0 h-screen max768:hidden">
        <div className="flex items-center gap-3 pt-0 px-5 pb-6 border-b border-b-[#1a1a1a]">
          <span className="w-9 h-9 bg-[#00ff88] text-[#0a0a0a] rounded-[8px] flex items-center justify-center font-extrabold text-[16px]">M</span>
          <div>
            <h2 className="text-[16px]! font-bold text-white m-0 font-sans tracking-[-0.02em]!">Money Stack</h2>
            <p className="text-[11px] text-[#555] mt-0.5 mx-0 mb-0">Dashboard de carrera</p>
          </div>
        </div>

        {/* `flex!` y `gap-0.5!`: la regla global `nav` de main.css fija display y gap (y lo oculta bajo 800 px). */}
        <nav className="flex-1 py-4 px-3 flex! flex-col gap-0.5!">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`${MS_NAV_ITEM} ${activeTab === item.id ? 'text-[#00ff88] bg-[rgba(0,255,136,0.08)]' : 'text-[#666] bg-transparent'}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="text-[14px] w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="py-4 px-5 border-t border-t-[#1a1a1a]">
          <a href="#artista/og-mauro" className="text-[12px] text-[#555]! font-sans hover:text-[#00ff88]!">← Ver perfil publico</a>
        </div>
      </aside>

      <main className="flex flex-col">
        <header className="flex items-center justify-between py-5 px-8 border-b border-b-[#1a1a1a] bg-[rgba(10,10,10,0.9)] backdrop-blur-[12px] sticky top-0 z-10">
          <h1 className="text-[20px]! font-bold text-white m-0 font-sans">
            {menuItems.find((m) => m.id === activeTab)?.label || 'Vista General'}
          </h1>
          <div className="flex items-center gap-2 text-[12px] text-[#00ff88]">
            <span className="w-2 h-2 bg-[#00ff88] rounded-[50%] animate-[msPulse_2s_ease-in-out_infinite]" />
            <span>Activo</span>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className={MS_CONTENT}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mb-10 max768:grid-cols-[repeat(2,1fr)]">
              <MetricCard label="Oyentes mensuales" value={latest.monthly_listeners?.valor || 0} trend={12} />
              <MetricCard label="Reproducciones totales" value={latest.total_streams?.valor || 0} trend={8} />
              <MetricCard label="Seguidores Spotify" value={latest.followers_spotify?.valor || 0} trend={5} />
              <MetricCard label="Seguidores Instagram" value={latest.followers_instagram?.valor || 0} trend={15} />
              <MetricCard label="Eventos realizados" value={latest.events_performed?.valor || 0} />
              <MetricCard label="Lanzamientos" value={latest.releases_count?.valor || 0} />
            </div>

            <div className="mb-10">
              <h3 className={MS_SECTION_TITLE}>Objetivos del mes</h3>
              <div className="flex flex-col gap-5">
                <ProgressBar label="Reproducciones Spotify" current={85000} target={100000} color="#1DB954" />
                <ProgressBar label="Seguidores Instagram" current={5800} target={8000} color="#E1306C" />
                <ProgressBar label="Eventos este trimestre" current={2} target={4} color="#d4a843" />
              </div>
            </div>

            <div className="mb-10">
              <h3 className={MS_SECTION_TITLE}>Actividad reciente</h3>
              <div className="flex flex-col gap-3">
                {activity.map((a) => (
                  <div key={a.text} className="flex items-center gap-3 py-3.5 px-4 bg-[#111] border border-[#1a1a1a] rounded-[10px]">
                    <span className={`w-2 h-2 rounded-[50%] shrink-0 ${a.dot}`} />
                    <span className="flex-1 text-[13px] text-[#ccc] font-sans">{a.text}</span>
                    <span className="text-[11px] text-[#555]">{a.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'music' && (
          <div className={MS_CONTENT}>
            <div className="mb-10">
              <h3 className={MS_SECTION_TITLE}>Mis lanzamientos</h3>
              <p className="text-[13px] text-[#555] -mt-3 mx-0 mb-5">Gestiona tu discografia y monitorea el rendimiento de cada lanzamiento.</p>
              <div className="border border-[#1a1a1a] rounded-[12px] overflow-hidden">
                <div className={`${MS_TABLE_GRID} bg-[#111] text-[11px] font-bold uppercase tracking-[0.1em] text-[#555]`}>
                  <span>Titulo</span>
                  <span>Tipo</span>
                  <span>Fecha</span>
                  <span>Estado</span>
                </div>
                {releases.map((r) => (
                  <div key={r.title} className={`${MS_TABLE_GRID} border-t border-t-[#1a1a1a] text-[13px] text-[#ccc] font-sans transition-[background] duration-200 ease-[ease] hover:bg-[rgba(255,255,255,0.02)]`}>
                    <span>{r.title}</span>
                    <span>{r.type}</span>
                    <span>{r.date}</span>
                    <span className="text-[11px] font-bold py-[3px] px-2.5 rounded-[999px] uppercase bg-[rgba(0,255,136,0.1)] text-[#00ff88]">Publicado</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className={MS_CONTENT}>
            <div className="mb-10">
              <h3 className={MS_SECTION_TITLE}>Estadisticas detalladas</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                {stats.map((s) => (
                  <div key={s.label} className={`${MS_CARD} p-6`}>
                    <span className="text-[12px] text-[#555]">{s.label}</span>
                    <span className="text-[32px] font-extrabold text-white font-sans">{s.value}</span>
                    <span className={`text-[12px] font-semibold ${s.up ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{s.change}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!['overview', 'music', 'stats'].includes(activeTab) && (
          <div className={MS_CONTENT}>
            <div className="flex flex-col items-center justify-center py-20 px-5 text-center">
              <span className="text-[48px] mb-4">🚧</span>
              <h3 className="text-[18px]! text-white mt-0 mx-0 mb-2! font-sans">Modulo en construccion</h3>
              <p className="text-[14px] text-[#555] m-0">Este modulo estara disponible proximamente.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
