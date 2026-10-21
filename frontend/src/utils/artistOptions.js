// Opciones de las secciones del perfil de artista que comparten el perfil publico y el editor del
// admin (components/admin/artist/). El editor solo ofrece lo que el perfil sabe pintar.

// Redes con icono propio en la cabecera del perfil (components/artist/ArtistHeader.jsx::platformIcons).
// Si se agrega una, sumar tambien su icono alla. El Media Kit muestra el nombre en texto, sirve cualquiera.
export const SOCIAL_PLATFORMS = [
  ['spotify', 'Spotify'],
  ['youtube', 'YouTube'],
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
];

// Tipos de conexion que pinta "Desde el territorio" (components/artist/ArtistInfo.jsx): etiqueta y color.
export const CONNECTION_TYPES = {
  event: ['Evento', '#F59E0B'],
  artist: ['Artista', '#EC4899'],
  collective: ['Colectivo', '#8B5CF6'],
  story: ['Historia', '#3B82F6'],
  place: ['Lugar', '#10B981'],
};

// Metricas (series en el tiempo; se muestra la ultima de cada tipo). Son los tipos que lee el panel
// del artista (screens/ArtistDashboard.jsx, que todavia trae sus etiquetas escritas a mano).
export const METRIC_TYPES = [
  ['monthly_listeners', 'Oyentes mensuales'],
  ['total_streams', 'Reproducciones totales'],
  ['followers_spotify', 'Seguidores Spotify'],
  ['followers_instagram', 'Seguidores Instagram'],
  ['events_performed', 'Presentaciones'],
  ['releases_count', 'Lanzamientos'],
];
