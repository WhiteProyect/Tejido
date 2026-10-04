import EmptyNote, { EMPTY_NOTE_ACTION } from '../components/EmptyNote.jsx';
import Icon from '../components/Icon.jsx';
import ScreenIntro from '../components/ScreenIntro.jsx';
import { SCREEN_SECTION } from '../components/uiStyles.js';

export default function SavedScreen() {
  return (
    <section className={SCREEN_SECTION}>
      <ScreenIntro eyebrow="Tu selección personal" title="Contenidos guardados" description="Aquí reuniremos las historias, eventos y oportunidades que quieras volver a visitar." />
      <div className="max-w-[560px]">
        <EmptyNote
          icon="bookmark"
          title="Sin guardados aún"
          text="Guarda sabores locales desde Explorar."
          action={<a className={EMPTY_NOTE_ACTION} href="#explorar">Explorar publicaciones <Icon name="arrow-right" className="size-4" /></a>}
        />
      </div>
    </section>
  );
}
