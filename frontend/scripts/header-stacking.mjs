// Prueba del apilamiento del header: nada de lo que se pinta debajo de el (secciones del inicio, Agenda,
// Oportunidades, Municipios, Mapa vivo, detalle...) puede taparlo.
//
//   npm --prefix frontend run test:header            (Vite debe estar corriendo en http://localhost:5173)
//   TEJIDO_URL=http://localhost:5174 npm --prefix frontend run test:header
//   HEADER_ONLY=inicio,mapa HEADER_WIDTHS=390 ...    (subconjunto de pantallas o anchos)
//
// Todo lo de /api se simula aqui (sesiones via /api/me, sin cuentas ni escrituras; nada llega a un
// backend), igual que las teselas del mapa. Dos comprobaciones por pantalla y ancho (1300, 768 y 390):
// 1. Auditoria en el navegador: cada elemento posicionado con z-index >= 5 debe tener, entre el y la
//    raiz, un ancestro que cree contexto de apilamiento (isolation, transform, opacity < 1, filter,
//    z-index con posicion, fixed/sticky...). Si no lo tiene compite con el header (z-5) y puede taparlo.
//    Quedan fuera el propio header y las capas que deben ir encima (fijas con z-index >= 60: menus,
//    dialogos, avisos, Hilo).
// 2. Recorrido: de abajo hacia arriba en pasos de 120 px (cada paso sube, asi el header se ve y el menu
//    de usuario no se cierra) y, en cada paso, document.elementFromPoint en 8 puntos a lo ancho del
//    header: lo de encima debe ser el header (o un descendiente) o una capa permitida. Se repite con el
//    menu de usuario abierto y, por debajo de 1280 px, con el menu movil abierto (pasos de 360 px).
// Sale con codigo 1 si algo falla y lista el paso, el punto y el elemento que tapa.
import { chromium } from 'playwright';
import { deflateSync } from 'node:zlib';

const BASE = (process.env.TEJIDO_URL || 'http://localhost:5173').replace(/\/$/, '');
const WIDTHS = (process.env.HEADER_WIDTHS || '1300,768,390').split(',').map(Number);
const ONLY = (process.env.HEADER_ONLY || '').split(',').filter(Boolean);
const STEP = 120;
const MENU_STEP = 360;
const COMPACT = 1280; // por debajo, el header pasa al menu movil (utils/navSections.js::NAV_COMPACT_QUERY)

// ───────── datos simulados ─────────
const pad = (n) => String(n).padStart(2, '0');
const iso = (offset, h = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00:00`; };
const IMG = (slug) => `/images/categorias/${slug}.jpg`;
const CATS = [['MUSICA', 'musica', 'Música'], ['DANZA', 'danza', 'Danza'], ['PATRIMONIO_MEMORIA', 'patrimonio-memoria', 'Patrimonio y memoria'],
  ['GASTRONOMIA_CULTURAL', 'gastronomia-cultural', 'Gastronomía cultural'], ['LITERATURA', 'literatura', 'Literatura']];
const publication = (id, kind, [key, slug], extra = {}) => ({
  id, author_id: 4, category_id: 1, kind, title: `${kind === 'EVENTO' ? 'Festival' : 'Historia'} del río ${id}`,
  summary: 'Un encuentro junto al río Cauca con música, cocina y memoria del Bajo Cauca.', content: 'Contenido de prueba con varias frases.\n\nSegundo párrafo.',
  image: IMG(slug), location: 'Malecón de Caucasia', start_date: kind === 'EVENTO' ? iso(3, 19) : null, end_date: null, link: null, featured: false,
  status: 'PUBLISHED', moderation_note: null, created_at: '2026-11-01T10:00:00+00:00', updated_at: '2026-11-04T10:00:00+00:00', deleted: false,
  cultural_category: key, municipality: 'caucasia', tagline: 'Una frase breve', tags: ['Río'], tradition_text: null, latitude: kind === 'EVENTO' ? 7.9862 : null,
  longitude: kind === 'EVENTO' ? -75.1968 : null, category: kind, color: '#1d8fa3', author: 'Equipo TEJIDO', favorite: false, ...extra,
});
const PUBLICATIONS = CATS.flatMap((cat, i) => [publication(100 + i, 'EVENTO', cat), publication(200 + i, 'HISTORIA', cat)]);
const DETAIL = { ...PUBLICATIONS[0], id: 501, images: [{ id: 1, url: IMG('danza'), alt_text: 'Foto', caption: '', position: 0 }, { id: 2, url: IMG('teatro'), alt_text: 'Foto', caption: '', position: 1 }],
  author_organization: { name: 'Casa de la Cultura', branch: 'MUSICA', photo_url: null }, author_slug: null, venue: 'Malecón', capacity: 200 };
const SLIDES = CATS.map(([, slug, label], i) => ({ type: 'PUBLICATION', key: `publication-${100 + i}`, kind: i % 2 ? 'HISTORIA' : 'EVENTO', title: `Diapositiva ${i + 1}`,
  summary: 'Resumen de la diapositiva del carrusel.', image: IMG(slug), badge: 'Evento · Caucasia', tags: [label], href: `#publicacion/${100 + i}`,
  cta_label: 'Ver evento', municipality: 'Caucasia', category_label: label }));
const agendaEvent = (id, extra) => ({ id, title: `Evento de la agenda ${id}`, summary: 'Una jornada junto al río con música y memoria.', image: IMG('musica'), kind: 'EVENTO',
  municipality: 'caucasia', municipality_label: 'Caucasia', cultural_category: 'musica', category_label: 'Música', location: 'Malecón de Caucasia',
  start_date: null, end_date: null, tradition_text: null, ...extra });
const AGENDA = { today: iso(0).slice(0, 10), upcoming: [1, 2, 3, 4, 5, 6].map((i) => agendaEvent(i, { start_date: iso(i, 18) })),
  traditions: [agendaEvent(7, { tradition_text: 'Cada 20 de julio' })], recent_past: [agendaEvent(8, { start_date: iso(-3, 19) })],
  counts: { upcoming: 6, traditions: 1, recent_past: 1 } };
const opportunity = (id, extra) => ({ id, title: `Convocatoria ${id}`, summary: 'Resumen', image: IMG('literatura'), municipality: 'caucasia', municipality_label: 'Caucasia',
  cultural_category: 'literatura', category_label: 'Literatura', type: { slug: 'convocatoria', label: 'Convocatoria', color: 'ocre' }, organizer: 'Casa de la Cultura',
  audience: 'Jóvenes', prize: '$3.000.000', requirements: ['Vivir en el Bajo Cauca'], end_date: null, location: 'Caucasia', link: 'https://ejemplo.co', closed: false, ...extra });
const OPPORTUNITIES = { today: AGENDA.today, open: [1, 2, 3, 4].map((i) => opportunity(i, { end_date: iso(i * 4) })), open_ended: [opportunity(5), opportunity(6)],
  closed: [opportunity(7, { end_date: iso(-20), closed: true })], counts: { open: 4, open_ended: 2, closed: 1 }, closed_next_offset: null };
const OPPORTUNITY_TYPES = [{ id: 1, slug: 'convocatoria', label: 'Convocatoria', color: 'ocre' }, { id: 2, slug: 'taller', label: 'Taller', color: 'menta' }];
const point = (id, type, lat, lng, extra = {}) => ({ key: `${type.toLowerCase()}-${id}`, type, id, title: `${type === 'LUGAR' ? 'Lugar' : 'Evento'} ${id}`, summary: 'Resumen',
  image: IMG('musica'), municipality: 'caucasia', municipality_label: 'Caucasia', cultural_category: 'musica', category_label: 'Música', location: 'Malecón',
  start_date: type === 'EVENTO' ? iso(2, 19) : null, end_date: null, tradition_text: null, lat, lng, href: `#publicacion/${id}`, ...extra });
const POINTS = [point(41, 'EVENTO', 7.9862, -75.1968), point(42, 'EVENTO', 7.9838, -75.194),
  point(51, 'LUGAR', 7.9852, -75.1961, { place_category: { slug: 'restaurantes', label: 'Restaurantes', icon: 'utensils', color: 'ocre' }, address: 'Malecón', phone: null, whatsapp: '573001234567', opening_hours: null, website: null })];
const MUNICIPALITY = { slug: 'caucasia', counts: { publications: PUBLICATIONS.length, talent: 0, artists: 0 },
  publications: PUBLICATIONS.map(({ id, title, summary, image, kind, cultural_category, location, start_date, municipality }) => ({ id, title, summary, image, kind, cultural_category, location, start_date, municipality })),
  talent: [], artists: [] };
const ADMIN = { id: 4, name: 'Camila Prueba', email: 'prueba@tejido.test', role: 'ADMIN', email_verified: true, branch: null, is_leader: false };

const PAGES = [
  ['inicio', '#inicio'], ['categoria', '#categoria/musica'], ['agenda', '#agenda'], ['oportunidades', '#oportunidades'],
  ['municipios', '#municipios'], ['municipio', '#municipio/caucasia'], ['mapa', '#mapa'], ['publicacion', '#publicacion/501'],
].filter(([name]) => !ONLY.length || ONLY.includes(name));

function solidPng(r, g, b) {
  const crc = (buf) => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of buf) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(256, 0); ihdr.writeUInt32BE(256, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(256).fill([r, g, b]).flat())]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array(256).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = solidPng(242, 239, 233);

function apiResponse(path, search, session) {
  if (path === '/api/me') return { user: session ? ADMIN : null };
  if (path === '/api/publications') return PUBLICATIONS;
  if (path === '/api/publications/501') return DETAIL;
  if (path === '/api/home/carousel') return { slides: SLIDES };
  if (path === '/api/agenda') return AGENDA;
  if (path === '/api/opportunities') return OPPORTUNITIES;
  if (path === '/api/opportunity-types') return OPPORTUNITY_TYPES;
  if (path === '/api/map/points') return { today: AGENDA.today, points: POINTS };
  if (path === '/api/municipalities/caucasia') return MUNICIPALITY;
  if (path === '/api/cultural-categories/covers') return {};
  if (path === '/api/categories') return [];
  return /s$|\/images$/.test(path) ? [] : {};
}

async function openPage(browser, width, hash, { session = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 860 } });
  if (session) await context.addInitScript(() => localStorage.setItem('tejido_token', 'sesion-simulada'));
  await context.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: TILE }));
  await context.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const body = route.request().method() === 'GET' ? apiResponse(url.pathname, url.search, session) : { message: 'ok' };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  page.problems = [];
  page.on('pageerror', (error) => page.problems.push(String(error)));
  await page.goto(`${BASE}/${hash}`);
  await page.waitForSelector('header');
  await page.waitForTimeout(1500);
  return page;
}

// ───────── 1. auditoria de z-index en el navegador ─────────
function auditInBrowser() {
  const header = document.querySelector('header');
  const describe = (el) => {
    const data = [...el.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}${a.value ? `=${a.value.slice(0, 20)}` : ''}]`).join('');
    const cls = (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').split(/\s+/).filter((c) => /^-?z-|^(absolute|relative|fixed|sticky)$/.test(c)).join('.');
    return `${el.tagName.toLowerCase()}${data}${cls ? `.${cls}` : ''}`;
  };
  // Que crea contexto de apilamiento (resumen de la especificacion CSS).
  const createsContext = (el) => {
    const s = getComputedStyle(el);
    if (el === document.documentElement) return 'raiz';
    if (s.isolation === 'isolate') return 'isolation';
    if ((s.position === 'fixed' || s.position === 'sticky')) return s.position;
    if (s.position !== 'static' && s.zIndex !== 'auto') return `z-index ${s.zIndex}`;
    if (s.transform !== 'none') return 'transform';
    if (Number(s.opacity) < 1) return 'opacity';
    if (s.filter !== 'none') return 'filter';
    if (s.backdropFilter && s.backdropFilter !== 'none') return 'backdrop-filter';
    if (s.mixBlendMode !== 'normal') return 'mix-blend-mode';
    if (/transform|opacity|filter/.test(s.willChange)) return 'will-change';
    if (/paint|layout|strict|content/.test(s.contain)) return 'contain';
    if (s.clipPath !== 'none' || (s.maskImage && s.maskImage !== 'none')) return 'clip/mask';
    if (s.display === 'flex' || s.display === 'grid') return null; // los hijos con z-index de un flex/grid no contienen a nadie mas
    return null;
  };
  const results = [];
  for (const el of document.querySelectorAll('body *')) {
    if (header.contains(el)) continue;
    const s = getComputedStyle(el);
    if (s.position === 'static' || s.zIndex === 'auto' || Number(s.zIndex) < 5 || s.display === 'none' || s.visibility === 'hidden') continue;
    if (s.position === 'fixed' && Number(s.zIndex) >= 60) continue; // capas que deben ir encima del header
    let container = null;
    for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      const reason = createsContext(node);
      if (reason) { container = `${describe(node)} (${reason})`; break; }
    }
    results.push({ element: describe(el), z: Number(s.zIndex), position: s.position, contained: Boolean(container), container });
  }
  return results;
}

// ───────── 2. recorrido con elementFromPoint ─────────
function coverageInBrowser() {
  const header = document.querySelector('header');
  const r = header.getBoundingClientRect();
  if (r.bottom <= 2) return { hidden: true };
  // elementFromPoint ignora lo que tiene pointer-events: none (la flora, decoraciones): mientras se mide,
  // todo recibe eventos y el resultado es lo que de verdad se pinta encima.
  const probe = document.createElement('style');
  probe.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
  document.head.appendChild(probe);
  const allowed = (el) => {
    if (!el || header.contains(el)) return true;
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.position === 'fixed' && Number(s.zIndex) >= 90) return true; // menu movil, su velo, dialogos y avisos
    }
    return false;
  };
  const failures = [];
  const ys = [r.top + Math.min(8, r.height / 4), r.top + r.height / 2, r.bottom - Math.min(8, r.height / 4)];
  for (let i = 0; i < 8; i++) {
    const x = Math.round(r.left + (r.width * (i + 0.5)) / 8);
    for (const y of ys) {
      const el = document.elementFromPoint(x, Math.round(y));
      if (!allowed(el)) {
        const owner = el.closest('[data-flora],section,article,[class*="z-"]') || el;
        failures.push({ x, y: Math.round(y), element: `${el.tagName.toLowerCase()}${el.dataset.flora ? `[data-flora=${el.dataset.flora}]` : ''}`, inside: `${owner.tagName.toLowerCase()}${owner.dataset.flora ? `[data-flora=${owner.dataset.flora}]` : ''}.${String(owner.className?.baseVal ?? owner.className).split(' ').slice(0, 4).join('.')}` });
      }
    }
  }
  probe.remove();
  return { hidden: false, failures };
}

// fromCurrent: arranca donde esta la pagina (el menu de usuario ya abierto se cerraria al bajar).
async function sweep(page, label, step, { fromCurrent = false } = {}) {
  const failures = [];
  let steps = 0;
  let height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (fromCurrent) height = await page.evaluate(() => window.scrollY);
  else {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), height);
    await page.waitForTimeout(300);
  }
  for (let y = height - step; y >= 0; y -= step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(280); // transicion del header (220 ms) y un cuadro de las animaciones
    let result = await page.evaluate(coverageInBrowser);
    if (result.hidden) { await page.waitForTimeout(300); result = await page.evaluate(coverageInBrowser); }
    steps++;
    if (result.hidden) failures.push({ label, scrollY: y, problem: 'el header no quedo visible' });
    else result.failures.forEach((f) => failures.push({ label, scrollY: y, ...f }));
  }
  console.log(`  ${label}: ${steps} pasos, ${failures.length} fallos`);
  return { steps, failures };
}

const browser = await chromium.launch();
const report = { audit: [], sweeps: [], failures: [], errors: [] };
for (const width of WIDTHS) {
  for (const [name, hash] of PAGES) {
    // Sin sesion: auditoria y recorrido normal.
    let page = await openPage(browser, width, hash);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(800); // carga lo perezoso (flora, mapas) antes de auditar
    for (const item of await page.evaluate(auditInBrowser)) report.audit.push({ width, page: name, ...item });
    let result = await sweep(page, `${width} ${name}`, STEP);
    report.sweeps.push({ width, page: name, mode: 'normal', steps: result.steps, failures: result.failures.length });
    report.failures.push(...result.failures);
    page.problems.forEach((p) => report.errors.push(`${width} ${name}: ${p}`));
    await page.context().close();

    // Con sesion simulada y el menu de usuario abierto (header en z-95).
    page = await openPage(browser, width, hash, { session: true });
    const avatar = page.getByRole('button', { name: /^Menú de / });
    if (await avatar.count()) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), height);
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo({ top: window.scrollY - 200, behavior: 'instant' }));
      await page.waitForTimeout(300);
      await avatar.click();
      result = await sweep(page, `${width} ${name} menu-usuario`, STEP, { fromCurrent: true });
      const stillOpen = await page.locator('header a[href="#perfil"]').count();
      report.sweeps.push({ width, page: name, mode: 'menu de usuario', steps: result.steps, failures: result.failures.length, menuOpen: Boolean(stillOpen) });
      report.failures.push(...result.failures);
      if (!stillOpen) report.failures.push({ label: `${width} ${name} menu-usuario`, problem: 'el menu de usuario se cerro durante el recorrido' });
    }
    await page.context().close();

    // Menu movil abierto (solo por debajo de 1280 px).
    if (width < COMPACT) {
      page = await openPage(browser, width, hash);
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      await page.waitForTimeout(500);
      result = await sweep(page, `${width} ${name} menu-movil`, MENU_STEP);
      report.sweeps.push({ width, page: name, mode: 'menu movil', steps: result.steps, failures: result.failures.length });
      report.failures.push(...result.failures);
      await page.context().close();
    }
  }
}
await browser.close();

const uncontained = report.audit.filter((item) => !item.contained);
const unique = (items) => [...new Map(items.map((item) => [`${item.page}|${item.element}|${item.z}`, item])).values()];
console.log(`Auditoria: ${report.audit.length} elementos con z-index >= 5 bajo el header; sin contener: ${uncontained.length}`);
unique(uncontained).forEach((item) => console.log(`  SIN CONTENER ${item.width} ${item.page}: ${item.element} z=${item.z} (${item.position})`));
unique(report.audit.filter((item) => item.contained)).forEach((item) => console.log(`  contenido    ${item.page}: ${item.element} z=${item.z} -> ${item.container}`));
const steps = report.sweeps.reduce((sum, s) => sum + s.steps, 0);
console.log(`Recorrido: ${report.sweeps.length} recorridos, ${steps} pasos, ${report.failures.length} fallos`);
report.sweeps.forEach((s) => console.log(`  ${s.width} ${s.page} (${s.mode}): ${s.steps} pasos, ${s.failures} fallos${s.menuOpen === false ? ' · el menu se cerro' : ''}`));
report.failures.slice(0, 60).forEach((f) => console.log(`  FALLA ${f.label} scrollY=${f.scrollY ?? '-'} ${f.problem || `punto (${f.x}, ${f.y}) tapado por ${f.element} dentro de ${f.inside}`}`));
if (report.failures.length > 60) console.log(`  ... y ${report.failures.length - 60} mas`);
report.errors.forEach((e) => console.log(`  ERROR DE PAGINA ${e}`));
if (process.env.HEADER_JSON) (await import('node:fs')).writeFileSync(process.env.HEADER_JSON, JSON.stringify(report, null, 1));
const ok = !report.failures.length && !uncontained.length && !report.errors.length;
console.log(ok ? '\nHEADER OK: nada lo tapa' : '\nHEADER CON PROBLEMAS');
process.exit(ok ? 0 : 1);
