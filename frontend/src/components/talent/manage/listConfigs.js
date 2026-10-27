import { MUNICIPALITIES } from '../../../utils/constants.js';
import { LIMITS } from './common.jsx';

// Configuracion de las pestañas de lista del editor (ListTab): clave del PUT, maximo, elemento
// vacio, campos y como se arma cada elemento para el backend. Los limites son los de
// backend/service/schemas/talent.py (LIMITS).
const blankToNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim());
const currentYear = () => new Date().getFullYear();

export const SERVICES = {
  key: 'services', title: 'Servicios', max: LIMITS.services, noun: 'servicio', addLabel: 'Agregar servicio',
  intro: 'Lo que se puede contratar: cada servicio con su precio (vacío = "a convenir"). Las etiquetas cortas aparecen en la tarjeta del listado.',
  empty: { title: '', tag: '', description: '', price: '', price_note: '' },
  name: (item) => item.title,
  fields: [
    { name: 'title', label: 'Título', max: LIMITS.serviceTitle, required: true, placeholder: 'Show de 45 min — tarima' },
    { name: 'tag', label: 'Etiqueta corta', max: LIMITS.serviceTag, placeholder: 'tarima, taller...' },
    { name: 'description', label: 'Descripción', max: LIMITS.serviceDescription, multiline: true, full: true },
    { name: 'price', label: 'Precio en pesos', type: 'price', hint: 'Solo números, sin puntos. Vacío = a convenir.' },
    { name: 'price_note', label: 'Nota del precio', max: LIMITS.priceNote, placeholder: 'por sesión' },
  ],
  toItem: (item) => ({
    title: String(item.title).trim(), tag: blankToNull(item.tag), description: blankToNull(item.description),
    price: String(item.price ?? '').trim() === '' ? null : Number(item.price), price_note: blankToNull(item.price_note),
  }),
  fromItem: (item) => ({ ...item, tag: item.tag || '', description: item.description || '', price: item.price ?? '', price_note: item.price_note || '' }),
};

export const SPECS = {
  key: 'specs', title: 'Ficha técnica', max: LIMITS.specs, noun: 'dato', addLabel: 'Agregar dato',
  intro: 'Pares etiqueta y valor: integrantes, duración, sonido, montaje, movilidad...',
  empty: { label: '', value: '' },
  name: (item) => item.label,
  fields: [
    { name: 'label', label: 'Etiqueta', max: LIMITS.specLabel, required: true, placeholder: 'Integrantes' },
    { name: 'value', label: 'Valor', max: LIMITS.specValue, required: true, placeholder: '6 músicos en escena' },
  ],
  toItem: (item) => ({ label: String(item.label).trim(), value: String(item.value).trim() }),
  fromItem: (item) => item,
};

export const MILESTONES = {
  key: 'milestones', title: 'Trayectoria', max: LIMITS.milestones, noun: 'hito', addLabel: 'Agregar hito',
  intro: 'Los momentos de su historia, en el orden en que quieres que se lean en el hilo.',
  empty: { year: '', title: '', description: '' },
  name: (item) => item.title || item.year,
  fields: [
    { name: 'year', label: 'Año', type: 'year', required: true, hint: () => `Entre 1900 y ${currentYear() + 1}.` },
    { name: 'title', label: 'Título', max: LIMITS.milestoneTitle, required: true },
    { name: 'description', label: 'Descripción', max: LIMITS.milestoneDescription, multiline: true, full: true },
  ],
  toItem: (item) => ({ year: Number(item.year), title: String(item.title).trim(), description: blankToNull(item.description) }),
  fromItem: (item) => ({ ...item, year: String(item.year), description: item.description || '' }),
};

export const ENDORSEMENTS = {
  key: 'endorsements', title: 'Respaldo', max: LIMITS.endorsements, noun: 'respaldo', addLabel: 'Agregar respaldo',
  intro: 'Aquí van reconocimientos y testimonios que el equipo o tú pueden respaldar; no se aceptan reseñas del público.',
  empty: { kind: 'RECOGNITION', title: '', text: '', rating: '' },
  name: (item) => item.title,
  fields: [
    { name: 'kind', label: 'Tipo', type: 'select', options: [['RECOGNITION', 'Reconocimiento'], ['TESTIMONIAL', 'Testimonio']] },
    { name: 'title', label: 'Título o autor', max: LIMITS.endorsementTitle, required: true, hint: 'En un testimonio, quién lo dice (persona o entidad).' },
    { name: 'text', label: 'Texto', max: LIMITS.endorsementText, multiline: true, full: true },
    { name: 'rating', label: 'Calificación', type: 'select', options: [['', 'Sin calificación'], ['5', '5 de 5'], ['4', '4 de 5'], ['3', '3 de 5'], ['2', '2 de 5'], ['1', '1 de 5']], show: (item) => item.kind === 'TESTIMONIAL' },
  ],
  toItem: (item) => ({
    kind: item.kind, title: String(item.title).trim(), text: blankToNull(item.text),
    rating: item.kind === 'TESTIMONIAL' && String(item.rating) !== '' ? Number(item.rating) : null,
  }),
  fromItem: (item) => ({ ...item, text: item.text || '', rating: item.rating ? String(item.rating) : '' }),
};

export const VENUES = {
  key: 'venues', title: 'Presentaciones', max: LIMITS.venues, noun: 'lugar', addLabel: 'Agregar lugar',
  intro: '"Dónde se ha presentado": los lugares aparecen en el perfil junto al mapa del Bajo Cauca.',
  empty: { name: '', municipality: '' },
  name: (item) => item.name,
  fields: [
    { name: 'name', label: 'Lugar', max: LIMITS.venueName, required: true, placeholder: 'Tarima Parque Las Ceibas' },
    { name: 'municipality', label: 'Municipio', type: 'select', options: [['', 'Sin municipio'], ...MUNICIPALITIES.map(({ id, name }) => [id, name])] },
  ],
  toItem: (item) => ({ name: String(item.name).trim(), municipality: item.municipality || null }),
  fromItem: (item) => ({ ...item, municipality: item.municipality || '' }),
};
