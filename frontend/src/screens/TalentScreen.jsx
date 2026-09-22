import ScreenIntro from '../components/ScreenIntro.jsx';
import { PUB_KIND, SCREEN_LIST, SCREEN_LIST_ITEM, SCREEN_LIST_TEXT, SCREEN_LIST_TITLE, SCREEN_SECTION, STATUS } from '../components/uiStyles.js';

export default function TalentScreen({ talents }) {
  return (
    <section className={SCREEN_SECTION}>
      <ScreenIntro eyebrow="Talento de aquí" title="Voces que llevan el río dentro." description="Conoce a artistas, portadores de tradición, líderes y creadores de Caucasia." />
      <div className={SCREEN_LIST}>
        {talents.length ? talents.map((talent) => <article className={SCREEN_LIST_ITEM} key={talent.id}><span className={PUB_KIND}>TALENTO</span><h2 className={SCREEN_LIST_TITLE}>{talent.title}</h2><p className={SCREEN_LIST_TEXT}>{talent.summary}</p><small>{talent.location || 'Caucasia'}</small></article>) : <p className={STATUS}>Pronto conocerás nuevos talentos.</p>}
      </div>
    </section>
  );
}
