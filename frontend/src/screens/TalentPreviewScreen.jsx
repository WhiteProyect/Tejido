import { useEffect, useState } from 'react';
import EmptyNote, { EMPTY_NOTE_ACTION } from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import TalentProfileView from '../components/talent/TalentProfileView.jsx';
import { StatusBadge, managePath, talentApi } from '../components/talent/manage/common.jsx';
import { ProfileSkeleton } from './TalentProfileScreen.jsx';

// Vista previa de un talento (#talento-vista-previa/<id>): el MISMO perfil publico
// (components/talent/TalentProfileView) alimentado con GET /api/talent/manage/{id}, que solo
// responde al admin y al lider de la rama del talento (el backend decide; cualquier otro ve "no
// disponible"). Franja fija arriba con el estado y "Volver al editor"; sin guardar ni compartir y
// con <meta name="robots" content="noindex"> mientras esta abierta.
function minPrice(services) {
  const prices = services.map((service) => service.price).filter((price) => price !== null && price !== undefined);
  return prices.length ? Math.min(...prices) : null;
}

function nextAvailable(availability) {
  const today = new Date().toISOString().slice(0, 10);
  return availability.map((item) => String(item.day).slice(0, 10)).filter((day, index) => availability[index].state === 'AVAILABLE' && day >= today).sort()[0] || null;
}

export default function TalentPreviewScreen({ id, user, authReady }) {
  const [state, setState] = useState({ loading: true, talent: null, error: '' });
  const allowed = user && ['ADMIN', 'GESTOR'].includes(user.role);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;
    if (!allowed || !/^\d+$/.test(String(id || ''))) {
      setState({ loading: false, talent: null, error: 'no-disponible' });
      return undefined;
    }
    let cancelled = false;
    setState({ loading: true, talent: null, error: '' });
    talentApi.detail(id)
      .then((detail) => {
        if (cancelled) return;
        setState({ loading: false, error: '', talent: { ...detail, price_from: minPrice(detail.services), next_available: nextAvailable(detail.availability), similar: [] } });
      })
      .catch(() => { if (!cancelled) setState({ loading: false, talent: null, error: 'no-disponible' }); });
    return () => { cancelled = true; };
  }, [id, allowed, authReady]);

  useEffect(() => {
    document.title = state.talent ? `Vista previa: ${state.talent.name} · TEJIDO` : 'Vista previa · TEJIDO';
  }, [state.talent]);

  if (!authReady || state.loading) return <ProfileSkeleton />;
  if (!state.talent) {
    return (
      <section className="min-h-[62vh] py-[100px] px-[6vw]">
        <div className="mx-auto max-w-[560px]">
          <EmptyNote icon="people" title="Vista previa no disponible" text="Solo la ven el equipo de TEJIDO y el líder de la rama de este talento, con su sesión iniciada."
            action={<a className={EMPTY_NOTE_ACTION} href="#talento">Ver el talento publicado <Icon name="arrow-right" className="size-4" /></a>} />
        </div>
      </section>
    );
  }

  const editorHref = `#${managePath(user.role === 'ADMIN' ? 'ADMIN' : 'LEADER', state.talent.id)}`;
  return (
    <>
      <div className="sticky top-0 z-[4] border-b border-b-[#e3d6bf] bg-[#fff3d6] py-3 px-[6vw]" role="region" aria-label="Vista previa">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3">
          <p className="m-0 flex flex-wrap items-center gap-2 text-[15px] leading-[1.4] text-ink">
            <strong>Vista previa</strong> — así se verá cuando se publique. No es pública.
            <StatusBadge status={state.talent.status} />
          </p>
          <a className="inline-flex items-center gap-2 rounded-full bg-ink py-2 px-4 text-[14px] font-bold text-white no-underline hover:bg-[#24574b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" href={editorHref}>
            <Icon name="arrow-left" className="size-4" /> Volver al editor
          </a>
        </div>
      </div>
      <TalentProfileView talent={state.talent} user={user} preview />
    </>
  );
}
