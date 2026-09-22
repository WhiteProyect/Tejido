import { EYEBROW, H1, PRIMARY_BUTTON, SCREEN_SECTION } from '../components/uiStyles.js';

export default function NotFoundScreen() {
  return <section className={SCREEN_SECTION}><p className={EYEBROW}>TEJIDO</p><h1 className={H1}>Esta pantalla todavía se está tejiendo.</h1><a className={PRIMARY_BUTTON} href="#inicio">Volver al inicio</a></section>;
}
