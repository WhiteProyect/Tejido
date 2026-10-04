import CategoryCoversGrid from './CategoryCoversGrid.jsx';
import { EYEBROW, H1, SECTION } from './uiStyles.js';

// Explorar: encabezado y portadas de las categorias culturales. Las publicaciones (y su
// buscador) viven en cada categoria (screens/CategoryScreen.jsx).
export default function ExploreSection() {
  return (
    <section className={SECTION} id="explorar">
      <div className="flex [align-items:end] gap-[50px] justify-between mb-[45px] max800:items-start max800:flex-col max800:gap-6">
        <div><p className={EYEBROW}>Voces desde capital</p><h2 className={H1}>Descubre el tejido de la cultura</h2></div>
        <p className="leading-[1.6] max-w-[340px]">Contenido local para encontrarnos, aprender y celebrar lo nuestro.</p>
      </div>
      <CategoryCoversGrid />
    </section>
  );
}
