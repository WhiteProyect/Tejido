import { useState } from 'react';
import ArtistForm from '../ArtistForm.jsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { adminArtistApi } from '../../../services/artistApi.js';
import { ConfirmButton, ErrorAlert, useAction } from './common.jsx';

// Pestana "Datos": ArtistForm en modo edicion y archivar (restaurar vive en el aviso del editor,
// visible en todas las pestanas mientras el artista esta archivado).
export default function DatosTab({ artist, readOnly, onChanged }) {
  const { showToast } = useToast();
  // Cancelar descarta lo escrito: remonta el formulario con los datos guardados.
  const [resets, setResets] = useState(0);
  const archive = useAction();

  async function handleSaved(saved) {
    showToast({ tone: 'menta', eyebrow: 'Hilo ajustado', title: 'Datos actualizados', text: `Los cambios de ${saved.stage_name} ya se ven en su perfil.` });
    await onChanged();
  }

  async function handleArchive() {
    const ok = await archive.run(async () => {
      await adminArtistApi.archive(artist.id);
      await onChanged();
    });
    if (ok) showToast({ tone: 'menta', eyebrow: 'Guardado aparte', title: 'Artista archivado', text: `${artist.stage_name} ya no aparece en la web pública. Puedes restaurarlo cuando quieras.` });
  }

  return (
    <>
      <ArtistForm
        key={`${artist.updated_at}-${resets}`}
        artist={artist}
        readOnly={readOnly}
        onSaved={handleSaved}
        onCancel={() => setResets((count) => count + 1)}
      />
      {!readOnly && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-[rgba(216,91,54,.25)] p-5">
          <div className="min-w-0 flex-1 basis-[280px]">
            <h3 className="m-0 font-sans text-[17px] font-bold text-ink">Archivar artista</h3>
            <p className="mt-1 mb-0 text-[14px] leading-[1.5] text-muted">Sale de la web pública y de Moneystack. Su contenido se conserva y puedes restaurarlo cuando quieras.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ConfirmButton label="Archivar" confirmLabel="Sí, archivar" itemName={artist.stage_name} busy={archive.busy} onConfirm={handleArchive} />
          </div>
          <ErrorAlert className="w-full">{archive.error}</ErrorAlert>
        </div>
      )}
    </>
  );
}
