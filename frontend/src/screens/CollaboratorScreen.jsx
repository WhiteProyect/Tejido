import { useState, useEffect } from 'react';
import { BTN_CULTURAL } from '../components/uiStyles.js';

// Clases repetidas del programa de colaboradores.
const SECTION = 'pt-[100px] px-[7vw] pb-20';
const H3 = 'font-sans tracking-[-.055em] text-[18px] font-bold mt-0 mx-0 mb-4 text-ink';
const EMPTY = 'text-muted text-[14px] text-center p-6';
const CARD = 'bg-white border border-line';
const ICON_BOX = 'w-8 h-8 bg-cream rounded-[8px] flex items-center justify-center text-river';
const LABEL = 'block text-[13px] font-semibold text-ink mb-1.5';
// select y textarea no heredan la fuente por la regla base (solo button, input): va explicito.
const FIELD = 'w-full py-2.5 px-3.5 border border-line rounded-[10px] text-[14px] [font-family:inherit] box-border';
const REPORT_STATUS = {
  success: 'bg-[#d4edda] text-[#155724]',
  error: 'bg-[#f8d7da] text-[#721c24]',
};

const LEVELS = {
  INICIADO: { color: '#6b7280', next: 'ACTIVO', required: 500 },
  ACTIVO: { color: '#1d8fa3', next: 'EMBAJADOR', required: 2000 },
  EMBAJADOR: { color: '#d4a843', next: 'LIDER', required: 5000 },
  LIDER: { color: '#e85d3a', next: null, required: null },
};

const ACTIVITY_ICONS = {
  INTERNAL_SHARE: '↗',
  EXTERNAL_SHARE: '↗',
  EXTERNAL_MENTION: '♪',
  EVENT_ATTEND: '◉',
  COMMUNITY_MEET: '◎',
  TEACH_TEJIDO: '◉',
  CONTENT_CREATE: '✦',
  PHOTO_PLACE: '◉',
  REFER_USER: '★',
};

export default function CollaboratorScreen({ user }) {
  const [profile, setProfile] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({ type: '', description: '', evidence_url: '' });
  const [reportStatus, setReportStatus] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function authHeaders() {
    const token = localStorage.getItem('tejido_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async function loadData() {
    try {
      const headers = authHeaders();
      const [profileRes, rewardsRes, typesRes] = await Promise.all([
        fetch('/api/collaborators/profile', { headers }),
        fetch('/api/collaborators/rewards', { headers }),
        fetch('/api/collaborators/activity-types', { headers }),
      ]);
      const profileData = await profileRes.json();
      const rewardsData = await rewardsRes.json();
      const typesData = await typesRes.json();
      setProfile(profileData);
      setRewards(rewardsData);
      setActivityTypes(typesData);
    } catch (err) {
      console.error('Error loading collaborator data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    try {
      const res = await fetch('/api/collaborators/register', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        loadData();
      } else {
        alert(data.message || 'Error al registrar');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  }

  async function handleReport(e) {
    e.preventDefault();
    setReportStatus(null);
    try {
      const res = await fetch('/api/collaborators/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(reportForm),
      });
      const data = await res.json();
      if (res.ok) {
        setReportStatus({ type: 'success', points: data.points_earned });
        setReportForm({ type: '', description: '', evidence_url: '' });
        loadData();
        setTimeout(() => {
          setShowReportForm(false);
          setReportStatus(null);
        }, 2000);
      } else {
        setReportStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setReportStatus({ type: 'error', message: 'Error de conexión' });
    }
  }

  async function handleRedeem(rewardId) {
    try {
      const res = await fetch('/api/collaborators/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reward_id: rewardId }),
      });
      const data = await res.json();
      if (res.ok) {
        loadData();
      } else {
        alert(data.message || 'Error al canjear');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  }

  function copyCode() {
    if (profile?.collaborator?.code) {
      navigator.clipboard.writeText(profile.collaborator.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  if (!user) {
    return (
      <section className={SECTION}>
        <div className="text-center py-20 px-5">
          <h2 className="font-sans tracking-[-.055em] leading-[.98] m-0 text-[28px] font-extrabold mb-3">Colaboradores TEJIDO</h2>
          <p className="text-muted mb-6">Inicia sesión para unirte al programa de colaboradores.</p>
          <a href="#login" onClick={() => sessionStorage.setItem('tejido_return_to', 'colaborador')} className={BTN_CULTURAL}>Iniciar Sesión</a>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={SECTION}>
        <div className="text-center p-20 text-muted">Cargando...</div>
      </section>
    );
  }

  if (!profile?.collaborator) {
    return (
      <section className={SECTION}>
        <div className="text-center py-20 px-5 max-w-[600px] my-0 mx-auto">
          <h2 className="font-sans tracking-[-.055em] leading-[.98] m-0 text-[32px] font-extrabold mb-3">Conviértete en Colaborador</h2>
          <p className="text-muted text-[16px] mb-8">Comparte el Bajo Cauca con el mundo y acumula puntos canjeables por beneficios exclusivos.</p>
          <div className="flex gap-6 justify-center mb-8 max768:flex-col max768:items-center">
            <div className="flex items-center gap-2 text-[14px] text-ink">
              <span className={`${ICON_BOX} font-bold`}>↗</span>
              <span>Comparte y gana puntos</span>
            </div>
            <div className="flex items-center gap-2 text-[14px] text-ink">
              <span className={`${ICON_BOX} font-bold`}>★</span>
              <span>Alcanza niveles exclusivos</span>
            </div>
            <div className="flex items-center gap-2 text-[14px] text-ink">
              <span className={`${ICON_BOX} font-bold`}>◉</span>
              <span>Canjea por recompensas</span>
            </div>
          </div>
          <button className={BTN_CULTURAL} onClick={handleRegister}>
            Unirme como Colaborador
          </button>
        </div>
      </section>
    );
  }

  const collab = profile.collaborator;
  const levelInfo = LEVELS[collab.level] || LEVELS.INICIADO;
  const progress = levelInfo.required ? Math.min((collab.points / levelInfo.required) * 100, 100) : 100;

  return (
    <section className={SECTION}>
      <div className="text-center mb-12">
        <h1 className="font-sans leading-[.98] text-[length:clamp(32px,4vw,48px)] font-extrabold tracking-[-0.04em] mt-0 mx-0 mb-3 text-ink">Mi Dashboard de Colaborador</h1>
        <p className="text-muted text-[16px]">Comparte, participa y acumula puntos</p>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-8 max-w-[1100px] my-0 mx-auto max768:grid-cols-[1fr]">
        <div className="flex flex-col gap-6">
          <div className="bg-[linear-gradient(135deg,var(--ink)_0%,#1a3a2e_100%)] rounded-[20px] p-8 text-white">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[56px] font-extrabold tracking-[-0.04em]">{collab.points}</span>
              <span className="text-[18px] text-[rgba(255,255,255,0.7)]">puntos</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="py-1 px-3 rounded-[999px] text-[12px] font-bold text-white uppercase tracking-[0.05em]" style={{ background: levelInfo.color }}>
                {collab.level}
              </span>
              {levelInfo.next && (
                <span className="text-[13px] text-[rgba(255,255,255,0.7)]">
                  {collab.points}/{levelInfo.required} para {levelInfo.next}
                </span>
              )}
            </div>
            <div className="h-2 bg-[rgba(255,255,255,0.15)] rounded-[4px] overflow-hidden">
              <div className="h-full rounded-[4px] transition-[width] duration-600 ease-[ease]" style={{ width: `${progress}%`, background: levelInfo.color }}></div>
            </div>
          </div>

          <div className={`${CARD} rounded-[16px] p-5`}>
            <span className="block text-[12px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">Tu código de referido</span>
            <div className="flex items-center gap-3">
              <span className="text-[20px] font-extrabold text-ink tracking-[0.05em] flex-1">{collab.code}</span>
              <button className="bg-cream border-none rounded-[8px] py-2 px-4 text-[13px] font-semibold cursor-pointer transition-all duration-200 ease-[ease] hover:bg-gold hover:text-white" onClick={copyCode}>
                {copiedCode ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 bg-transparent bg-[linear-gradient(135deg,var(--river)_0%,var(--forest)_100%)] text-white border-none rounded-[12px] py-3.5 px-6 text-[15px] font-bold cursor-pointer transition-all duration-300 ease-[ease] hover:[transform:translateY(-2px)] hover:[box-shadow:0_8px_24px_rgba(29,143,163,0.3)]" onClick={() => setShowReportForm(!showReportForm)}>
              Reportar Actividad
            </button>
          </div>

          {showReportForm && (
            <form className={`${CARD} rounded-[16px] p-6`} onSubmit={handleReport}>
              <div className="mb-4">
                <label className={LABEL}>Tipo de actividad</label>
                <select
                  className={FIELD}
                  value={reportForm.type}
                  onChange={e => setReportForm({ ...reportForm, type: e.target.value })}
                  required
                >
                  <option value="">Selecciona...</option>
                  {activityTypes.map(at => (
                    <option key={at.type} value={at.type}>
                      {at.name} (+{at.default_points} pts)
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className={LABEL}>Descripción</label>
                <textarea
                  className={`${FIELD} min-h-20 resize-y`}
                  value={reportForm.description}
                  onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                  placeholder="Cuéntanos qué hiciste..."
                  required
                />
              </div>
              <div className="mb-4">
                <label className={LABEL}>Evidencia (opcional)</label>
                <input
                  className={FIELD}
                  type="url"
                  value={reportForm.evidence_url}
                  onChange={e => setReportForm({ ...reportForm, evidence_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              {reportStatus && (
                <div className={`py-2.5 px-3.5 rounded-[10px] text-[14px] font-semibold mb-3 ${REPORT_STATUS[reportStatus.type]}`}>
                  {reportStatus.type === 'success'
                    ? `+${reportStatus.points} puntos ganados`
                    : reportStatus.message}
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" className={BTN_CULTURAL}>Enviar</button>
                <button type="button" className="bg-cream border-none rounded-[10px] py-2.5 px-5 text-[14px] font-semibold cursor-pointer" onClick={() => setShowReportForm(false)}>Cancelar</button>
              </div>
            </form>
          )}

          <div>
            <h3 className={H3}>Actividad Reciente</h3>
            {profile.activities.length === 0 ? (
              <p className={EMPTY}>Aún no has registrado actividad</p>
            ) : (
              <div className="flex flex-col gap-3">
                {profile.activities.map(act => (
                  <div className={`${CARD} flex items-center gap-3 py-3 px-4 rounded-[12px]`} key={act.id}>
                    <span className={`${ICON_BOX} text-[14px] shrink-0`}>{ACTIVITY_ICONS[act.type] || '·'}</span>
                    <div className="flex-1 flex flex-col">
                      <span className="text-[14px] font-medium text-ink">{act.description}</span>
                      <span className="text-[12px] text-muted">
                        {new Date(act.created_at).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                    <span className="text-[14px] font-bold text-gold">+{act.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h3 className={H3}>Ranking del Mes</h3>
            {profile.ranking.length === 0 ? (
              <p className={EMPTY}>Sin datos aún</p>
            ) : (
              <div className="flex flex-col gap-2">
                {profile.ranking.map((r, i) => (
                  <div className={`flex items-center gap-3 py-2.5 px-3.5 border rounded-[10px] ${r.id === collab.id ? 'border-gold bg-[rgba(212,168,67,0.05)]' : 'border-line bg-white'}`} key={r.id}>
                    <span className="w-6 h-6 bg-cream rounded-[50%] flex items-center justify-center text-[12px] font-bold text-ink shrink-0">{i + 1}</span>
                    <span className="flex-1 text-[14px] font-medium">{r.name}</span>
                    <span className="text-[14px] font-bold text-river">{r.points}</span>
                  </div>
                ))}
                {profile.user_position && profile.user_position > 10 && (
                  <div className="text-center text-[13px] text-muted p-2">
                    Tu posición: #{profile.user_position}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className={H3}>Recompensas</h3>
            <div className="flex flex-col gap-3">
              {rewards.map(reward => (
                <div className={`${CARD} rounded-[12px] p-4`} key={reward.id}>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] text-river bg-[rgba(29,143,163,0.1)] py-[3px] px-2 rounded-[4px] mb-2">{reward.category}</span>
                  <h4 className="text-[15px] font-bold mt-0 mx-0 mb-1">{reward.name}</h4>
                  <p className="text-[12px] text-muted mt-0 mx-0 mb-3 leading-[1.4]">{reward.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-gold">{reward.points_cost} pts</span>
                    <button
                      className="bg-ink text-white border-none rounded-[8px] py-1.5 px-3.5 text-[13px] font-semibold cursor-pointer transition-all duration-200 ease-[ease] enabled:hover:bg-forest disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => handleRedeem(reward.id)}
                      disabled={collab.points < reward.points_cost}
                    >
                      Canjear
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
