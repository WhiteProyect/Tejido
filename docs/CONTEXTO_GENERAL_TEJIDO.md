# Contexto general de TEJIDO

> Documento de orientación para quienes se incorporan al proyecto. Describe la
> intención de producto, la experiencia y el estado funcional observado en el
> repositorio, actualizado el 26 de septiembre de 2026 tras un pivote de
> enfoque decidido por el dueño del proyecto (ver "Pivote de enfoque
> 2026-09-26" más abajo). Para las reglas visuales detalladas, consultar
> `MANUAL_ESENCIA_TEJIDO.md`; para el historial técnico reciente, consultar
> `HANDOFF.md`.

## En una frase

**TEJIDO es el portal cultural y turístico de Caucasia: la plataforma visual
que conecta y muestra el arte, la cultura, los eventos y el potencial turístico
del municipio, con vistas puntuales a los demás municipios del Bajo Cauca a
través de sus artistas y eventos.**

No es la página oficial de la Casa de la Cultura de Caucasia ni un producto
aparte de Moneystack: es el espacio donde ambos aliados ganan visibilidad, y
donde cualquier persona —habitante, turista, artista o gestor cultural— entra
a ver todo lo que Caucasia tiene y representa. Su promesa es que alguien
descubra que su municipio es más amplio, vivo y rico de lo que imaginaba, y
que un turista nuevo tenga la facilidad de explorar puntos de interés
culturales y locales, desde arte y música hasta comida, hospedaje y lugares
que visitar.

## El problema que aborda 

En Caucasia, las iniciativas, creadores, encuentros, relatos y puntos de
interés turístico suelen existir de forma dispersa: se conocen tarde, solo
dentro de un círculo, o simplemente no hay un lugar donde alguien pueda verlos
todos juntos. TEJIDO reúne esas piezas sin quitarles su contexto cultural.
Convierte información aislada en un recorrido que invita a explorar, guardar,
compartir y participar.

## Pivote de enfoque (2026-09-26)

TEJIDO nació como un espacio de descubrimiento territorial para los seis
municipios del Bajo Cauca por igual. El dueño del proyecto redefinió el
enfoque: **Caucasia es ahora el centro**, y los demás municipios aparecen de
forma puntual, no como eje central del producto. Este cambio se aplica de
forma incremental —no como una depuración de golpe— a medida que se construye
y toca cada parte bajo el nuevo enfoque.

Lo que se mantiene sin cambios: la identidad visual, la voz y el tono, Hilo,
el ciclo editorial, los roles y la arquitectura técnica.

Lo que cambia:

- El foco pasa de "todo el Bajo Cauca" a "Caucasia, con vistas puntuales a los
  demás municipios" (ver más abajo).
- Se suman dos aliados estratégicos formales: la Casa de la Cultura de
  Caucasia y Moneystack (ver "Aliados estratégicos").
- Se proyecta un directorio turístico curado (hoteles, restaurantes, puntos de
  interés) y un mapa vivo con filtros por interés — en definición, ver
  "Estado funcional y límites conocidos".
- Los medios (imágenes, video) se planean en un servicio en la nube (por
  ejemplo Cloudinary) en vez de archivos locales, como parte de tratar TEJIDO
  como un portal aplicativo profesional y no como un proyecto local.
- El idioma sigue siendo español únicamente; inglés queda para una fase
  posterior.

## Aliados estratégicos

| Aliado | Rol en TEJIDO |
| --- | --- |
| Casa de la Cultura de Caucasia | Aliada y patrocinadora: promociona TEJIDO como su portal de referencia para mostrar arte y cultura. No tiene una sección propia dentro de la plataforma; sus publicaciones (agenda, noticias, programas, eventos) se muestran con una etiqueta que identifica que son de la Casa de la Cultura. |
| Moneystack | Aliado artístico y musical principal: sello discográfico independiente de artistas emergentes que también gestiona y organiza eventos artísticos. Es la capa musical de TEJIDO y mantiene su propia sección dentro de la plataforma (ver "Moneystack y el talento musical"). |

## La metáfora: tejer

El nombre no es decorativo. Un hilo aislado es frágil; varios hilos conforman
una estructura con sentido. En TEJIDO, los hilos son las personas, los
municipios, los relatos, las iniciativas y las oportunidades. El espacio los
relaciona para que el usuario no sea solo espectador:

- Explorar suma un hilo de conocimiento.
- Guardar ancla aquello que se quiere retomar.
- Compartir extiende un hilo hacia otras personas.
- Descubrir municipios llena el pasaporte territorial.
- Enviar una sugerencia introduce un hilo nuevo al sistema.

La referencia territorial de esta metáfora son los ríos Cauca y Nechí: así como
conectan municipios y vidas, TEJIDO conecta digitalmente lo que está separado.

## Territorio al que sirve

**Caucasia es, al lanzamiento, el único territorio con enfoque completo**: es
donde vive el directorio turístico, la agenda cultural y la mayoría del
contenido curado. Los otros cinco municipios del Bajo Cauca siguen presentes
en TEJIDO, pero de forma puntual —principalmente a través de artistas y
eventos que Moneystack organiza o representa en esos lugares—, no como un
recorrido completo y equivalente al de Caucasia:

| Municipio | Papel narrativo en TEJIDO |
| --- | --- |
| Caucasia | Enfoque principal: capital, confluencia y centro del portal cultural y turístico. |
| Cáceres | Vista puntual: historia, tradición colonial y memoria minera; presencia vía artistas/eventos. |
| Tarazá | Vista puntual: café, agricultura, paisajes verdes y tradición campesina; presencia vía artistas/eventos. |
| Nechí | Vista puntual: río, minería y comunidades afrocolombianas con raíces ancestrales; presencia vía artistas/eventos. |
| El Bagre | Vista puntual: oro, folclor e identidad ligada a artistas y música; presencia vía artistas/eventos de Moneystack. |
| Zaragoza | Vista puntual: historia minera, naturaleza y memoria de fundación; presencia vía artistas/eventos. |

El landing conserva referencias a los seis municipios y la metáfora de tejer
el territorio (ver más abajo) porque sostiene la identidad de marca, pero el
contenido curado y las funcionalidades nuevas (mapa vivo, directorio
turístico) priorizan Caucasia. TEJIDO no pretende presentar estos lugares como
una ficha técnica. Busca contar qué se siente estar allí y qué está pasando en
cada uno.

## Qué reúne

La unidad central de contenido es la **publicación**. Puede ser:

- **Evento:** planes para encontrarse, aprender o celebrar.
- **Historia:** memoria, voces y relatos del territorio.
- **Talento:** artistas, creadores, líderes y portadores de tradición.
- **Oportunidad:** convocatorias, proyectos y espacios para participar.
- **Iniciativa:** acciones que se construyen colectivamente.

Una publicación puede incluir título, resumen, contenido completo, imagen,
ubicación, fechas, enlace, categoría e imágenes adicionales. Los eventos y las
oportunidades tienen información específica adicional, como lugar/capacidad o
entidad/fecha límite.

## Experiencia para una persona visitante

El recorrido actual se organiza mediante rutas con hash y no exige cuenta para
consultar lo publicado:

| Espacio | Para qué sirve |
| --- | --- |
| Inicio | Introduce el territorio, contenidos destacados, mapa, cronología y artista destacado. |
| Explorar | Busca, filtra y ordena publicaciones. |
| Mapa vivo | Ubica y permite recorrer los seis municipios; se proyecta filtrar por interés usando las categorías de publicación (evento, historia, talento, oportunidad, iniciativa). |
| Agenda | Agrupa los eventos disponibles. |
| Oportunidades | Reúne convocatorias y espacios de participación. |
| Talento | Presenta las publicaciones de talento local. |
| Moneystack | Da un espacio al sello musical y a sus artistas. |
| Artista | Muestra perfil, música, trayectoria, medios, redes y conexiones de cada artista. |
| Nosotros | Explica el propósito, el equipo temporal y permite enviar sugerencias. |

El recorrido se acompaña de **Hilo**, el guía visual de TEJIDO. Hilo no debe
comportarse como un chatbot invasivo: es un personaje cercano que saluda,
orienta, celebra descubrimientos y acompaña sin tapar el contenido. Su regla de
oro es: *acompaña, no dirige*.

## Participación, perfiles y roles

Hay tres roles con responsabilidades diferenciadas:

| Rol | Qué puede hacer |
| --- | --- |
| Ciudadanía | Consultar lo publicado, guardar favoritos, reportar contenido y ver su recorrido territorial. |
| Gestor cultural | Crear, editar y enviar sus publicaciones a revisión; además, gestionar su perfil de artista si está asociado a uno. |
| Administración | Moderar publicaciones, consultar métricas generales y revisar sugerencias/reportes. |

El ciclo editorial es **borrador o rechazado → revisión → publicado o
rechazado**. Un gestor solo modifica sus propios borradores o contenidos
rechazados; la publicación y el rechazo son decisiones de administración. El
borrado de publicaciones es lógico, para preservar el registro.

El perfil privado adapta la información al rol: administración ve el pulso de
la plataforma y los mensajes; gestión ve sus publicaciones y acceso a su panel
de artista; ciudadanía ve favoritos y su pasaporte.

## Pasaporte, colaboración y reconocimiento

El **pasaporte territorial** representa el descubrimiento de los seis
municipios. Al completar el recorrido se plantea el reconocimiento de
“Ciudadano del Bajo Cauca”. Actualmente su avance se conserva localmente en el
dispositivo, no como historial sincronizado de cuenta.

El backend también contempla un programa de colaboración: registro de
colaboradores, actividades, puntos, ranking y recompensas, incluyendo puntos
por compartir publicaciones. Es una capacidad existente a nivel de API, pero
la pantalla pública específica de colaboración fue retirada; por eso no debe
presentarse como un flujo de interfaz terminado.

## Moneystack y el talento musical

Moneystack es la capa musical de TEJIDO, no un producto aparte. Da visibilidad
a un sello y a sus artistas del Bajo Cauca. Cada artista puede tener perfil
público, catálogo musical, hitos cronológicos, galería/medios, enlaces sociales,
conexiones con otras entidades y un media kit. Administración o el gestor
asociado pueden mantener esos datos desde el dashboard correspondiente.

Los datos de desarrollo incluyen artistas de demostración como Og Mauro y DJ
Apolo; deben entenderse como contenido de seed, no como una declaración
editorial exhaustiva del talento regional.

## Voz y relación con la comunidad

TEJIDO habla como un vecino curioso que acaba de encontrar algo valioso y quiere
compartirlo. La voz es cercana, humana, optimista, joven y orgullosa del Bajo
Cauca. Invita en vez de ordenar y evita el tono institucional, periodístico,
corporativo o excesivamente técnico.

Prefiere palabras como *descubrir, explorar, tejer, conectar, territorio,
comunidad, historia, talento* y *participar*. Los mensajes de error y estados
vacíos también acompañan: no dicen “no hay datos”, sino que abren una
posibilidad de descubrimiento.

## Identidad visual en síntesis

La identidad se extrae del territorio, no de tendencias genéricas:

- **Tinta verde (`#173f36`)**: voz principal, raíces, bosque y profundidad.
- **Papel y crema**: calidez, conversación y arena/ribera.
- **Río (`#1d8fa3`)**: conexión y movimiento.
- **Dorado (`#d4a843`)**: orgullo territorial y herencia minera.
- **Naranja**: energía, urgencia y eventos.
- **Menta**: vegetación y crecimiento.
- **Morado**: memoria ancestral y misterio.

DM Sans es la voz tipográfica principal. Playfair Display en cursiva aparece
solo como énfasis poético dentro de títulos. Los símbolos tampoco son
ornamento: el río/serpiente es conexión, los tres círculos son encuentro, los
sellos son recorrido, las rutas punteadas son caminos y la cronología son los
hilos del tiempo. El manual de esencia define las reglas precisas de uso,
animación, responsive y accesibilidad de estos elementos.

## Arquitectura que sostiene el producto

| Capa | Implementación actual |
| --- | --- |
| Interfaz | React, Vite, JavaScript, Tailwind CSS v4 y Framer Motion. |
| API | FastAPI con rutas por dominio: autenticación, publicaciones, artistas, administración, colaboración y utilidades. |
| Datos | PostgreSQL en Neon mediante SQLAlchemy 2.0; Alembic versiona las migraciones. |
| Seguridad | Sesiones Bearer persistidas, contraseñas con PBKDF2-SHA256, límite de intentos de inicio de sesión y validación de entradas. |
| Calidad | Pruebas `pytest` contra un esquema PostgreSQL temporal y validación visual del frontend. |

El frontend consulta la API bajo `/api`; Vite la proxifica en desarrollo. La
base de datos se configura exclusivamente mediante `DATABASE_URL`, fuera del
código y fuera del control de versiones.

## Estado funcional y límites conocidos

La base de producto es real: hay autenticación, roles, catálogo y moderación de
publicaciones, artistas, perfiles, sugerencias, mapa, agenda y contenido
territorial. Sin embargo, este contexto debe leerse con estas precisiones:

- Guardar favoritos existe en la API, pero la interfaz de guardado aún no está
  integrada en las tarjetas; por eso los guardados suelen permanecer vacíos
  para una persona que navega la UI actual.
- El módulo de colaboración y recompensas existe en backend, pero su pantalla
  de frontend ya no forma parte del recorrido actual.
- El pasaporte se mide localmente por dispositivo.
- Faltan imágenes locales esperadas para los seis municipios en
  `frontend/public/assets/municipios/`; el mapa puede mostrar fondos de reserva
  donde deberían aparecer esas fotos.
- El despliegue público, dominio y contenerización siguen deliberadamente
  pendientes; el proyecto está orientado hoy al cierre de funcionalidades.
- El directorio turístico (hoteles, restaurantes, puntos de interés) está
  decidido en concepto —recomendaciones curadas por el equipo de TEJIDO, sin
  autogestión del negocio— pero su modelo de datos (categoría nueva de
  publicación vs. entidad propia como Artista) sigue sin definir; está a la
  espera de un prototipo de diseño de card que el dueño va a compartir.
- El mapa vivo con filtro por interés está decidido a nivel de concepto para
  usar como filtros las categorías de publicación ya existentes (evento,
  historia, talento, oportunidad, iniciativa), pero aún no está implementado.
- La migración de imágenes/video a un servicio en la nube (por ejemplo
  Cloudinary) está decidida a nivel de concepto pero no implementada; hoy los
  medios siguen manejándose como archivos locales.

## Criterio para tomar decisiones

Antes de sumar una pantalla, texto, dato, interacción o cambio visual, usar
este filtro:

> ¿Esto hace que alguien sienta que Caucasia —su cultura, su arte y su
> potencial turístico— es más vivo, más conectado y más digno de ser
> descubierto?

Si la respuesta es sí, la decisión está alineada con Tejido. Si no, debe
cuestionarse aunque sea técnicamente correcta.

## Documentos de referencia

- `README.md`: instalación, stack, seguridad y operación local.
- `docs/MANUAL_ESENCIA_TEJIDO.md`: fuente de verdad de la marca, narrativa,
  tono, diseño y experiencia.
- `docs/HANDOFF.md`: decisiones, cambios recientes, pendientes y advertencias
  de mantenimiento.
- `AGENTS.md`: reglas de desarrollo y convivencia técnica del repositorio.
