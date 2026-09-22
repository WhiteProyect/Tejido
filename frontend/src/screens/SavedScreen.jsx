import ScreenIntro from '../components/ScreenIntro.jsx';
import { H1, SCREEN_SECTION } from '../components/uiStyles.js';

export default function SavedScreen() {
  return (
    <section className={SCREEN_SECTION}>
      <ScreenIntro eyebrow="Tu selección personal" title="Contenidos guardados" description="Aquí reuniremos las historias, eventos y oportunidades que quieras volver a visitar." />
      <div className="bg-[#fffaf2] border border-[#e2d9ca] max-w-[560px] p-[45px] text-center"><span className="text-[#df6d43] text-[50px]" aria-hidden="true">♡</span><h2 className={H1}>Aún no has guardado contenido</h2><p className="text-[#53645c] leading-[1.5]">Explora las publicaciones y guarda las que quieras consultar después.</p></div>
    </section>
  );
}
