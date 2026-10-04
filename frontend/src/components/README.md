# Componentes React

Piezas visuales reutilizables. Las pantallas completas viven en `../screens/`.

- `Logo.jsx`: identidad visual de TEJIDO.
- `SiteHeader.jsx`: navegación principal y acceso de usuario.
- `HeroInteractive.jsx`: hero interactivo de la portada.
- `ExploreSection.jsx`: filtros, búsqueda y estados de carga.
- `PublicationCard.jsx`: tarjeta de publicación.
- `CategoryCoversGrid.jsx`: portadas de las categorías culturales en Explorar (sin filtro ni búsqueda); llevan a `#categoria/<slug>` (`screens/CategoryScreen.jsx`).
- `VideoText.jsx`, `TimelineSection.jsx`, `ScreenIntro.jsx`: secciones de portada y transiciones.
- `PassportSection.jsx`: tarjeta del pasaporte, hoy sin usar (salió del Inicio; la lógica de sellos sigue en `utils/passportUtils.js`).
- `HiloAssistant.jsx`: asistente Hilo.
- `Toast.jsx`: aviso breve (uno a la vez, 4 s); se dispara con `useToast()` de `context/ToastContext.jsx`, tonos en `utils/constants.js::TOAST_TONES`.
- `EmptyNote.jsx`: estado vacío compartido (icono morado, título, texto, acción opcional; `compact` para espacios bajos).
- `Footer.jsx`: pie de página compartido.
- `artist/`: componentes del perfil de artista.
