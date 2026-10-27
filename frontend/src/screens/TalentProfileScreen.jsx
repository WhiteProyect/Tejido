import { useEffect, useState } from 'react';
import EmptyNote, { EMPTY_NOTE_ACTION } from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import TalentProfileView from '../components/talent/TalentProfileView.jsx';
import { BTN_INK_MD } from '../components/uiStyles.js';
import { apiRequest } from '../utils/api.js';

// Perfil publico de un talento (#talento/<slug>): carga GET /api/talent/{slug} y lo pinta con
// components/talent/TalentProfileView.jsx (la misma presentacion que usa la vista previa).
export function ProfileSkeleton() {
  return (
    <section className="min-h-[62vh] py-[50px] px-[6vw]" aria-busy="true">
      <p className="sr-only" role="status">Cargando el perfil...</p>
      <div className="mx-auto grid max-w-[1100px] grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] gap-4 max768:grid-cols-[minmax(0,1fr)]" aria-hidden="true">
        <div className="h-[420px] rounded-[14px] bg-[#efe6d6] motion-safe:animate-pulse max768:h-[180px]" />
        <div className="rounded-[6px] bg-[#f3ead9] max768:h-[220px]" />
      </div>
    </section>
  );
}

export default function TalentProfileScreen({ slug, user }) {
  const [state, setState] = useState({ loading: true, talent: null, error: '', notFound: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, talent: null, error: '', notFound: false });
    apiRequest(`/api/talent/${encodeURIComponent(slug || '')}`)
      .then((talent) => { if (!cancelled) setState({ loading: false, talent, error: '', notFound: false }); })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, talent: null, error: error.message, notFound: error.status === 404 });
      });
    return () => { cancelled = true; };
  }, [slug, attempt, user?.id]);

  const talent = state.talent;
  useEffect(() => {
    document.title = talent ? `${talent.name} · Talento · TEJIDO` : 'Talento · TEJIDO';
  }, [talent]);

  if (state.loading) return <ProfileSkeleton />;

  if (!talent) {
    return (
      <section className="min-h-[62vh] py-[100px] px-[6vw]">
        <div className="mx-auto max-w-[560px]">
          {state.notFound ? (
            <EmptyNote icon="people" title="Este talento no está disponible" text="Puede que el enlace esté mal escrito o que el perfil ya no esté publicado."
              action={<a className={EMPTY_NOTE_ACTION} href="#talento">Ver todo el talento <Icon name="arrow-right" className="size-4" /></a>} />
          ) : (
            <div className="text-center" role="alert">
              <p className="m-0 text-[17px] font-bold text-ink">No pudimos cargar este perfil</p>
              <p className="mt-1 mb-5 text-[14px] text-[#53645c]">{state.error}</p>
              <button type="button" className={BTN_INK_MD} onClick={() => setAttempt(attempt + 1)}>Reintentar</button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return <TalentProfileView talent={talent} user={user} />;
}
