// Estado editorial de una publicacion (Publication.status): [etiqueta, clases del badge].
// Lo usan el perfil (ProfileScreen) y el Dashboard del Gestor (GestorDashboard).
export const STATUS_LABELS = {
  PUBLISHED: ['Publicada', 'bg-[rgba(29,143,163,0.1)] text-[#146f80]'],
  REVIEW: ['En revisión', 'bg-[rgba(212,168,67,0.18)] text-[#7a5c12]'],
  DRAFT: ['Borrador', 'bg-[rgba(102,116,111,0.12)] text-[#4d5a55]'],
  REJECTED: ['Por ajustar', 'bg-[rgba(216,91,54,0.12)] text-[#a8431f]'],
};
