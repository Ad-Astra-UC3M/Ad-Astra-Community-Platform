/**
 * @file Gestión de foto de perfil en un diálogo accesible: subida, vista previa y retirada,
 * junto al banner original de Avatar Studio. Las Server Actions conservan la validación real.
 */
"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react";
import { Camera, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import AvatarStudioBanner from "../../components/avatar/AvatarStudioBanner";
import { primaryButtonClass, secondaryButtonClass } from "../../components/form-styles";
import { portalAlertClassName } from "../../components/portal-ui";
import { ProfileAvatar } from "../../components/profile-avatar";
import { AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_BYTES } from "../../server/profiles/avatar-validation";

/**
 * Indica el guardado pendiente desde el formulario de subida.
 * @param props.hasAvatar Si la acción sustituye una foto existente.
 * @returns Botón que envía el archivo a uploadProfileAvatarAction.
 */
function UploadSubmitButton({ hasAvatar }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={primaryButtonClass}>
    {pending ? "Guardando foto…" : hasAvatar ? "Cambiar foto" : "Guardar foto"}
  </button>;
}

/**
 * Envía la retirada actual o el reintento de borrado pendiente.
 * @param props.hasAvatar Si hay una imagen vigente en el perfil.
 * @returns Botón secundario conectado a removeProfileAvatarAction.
 */
function RemoveSubmitButton({ hasAvatar }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={secondaryButtonClass}>
    {pending ? "Quitando foto…" : hasAvatar ? "Quitar foto" : "Completar retirada"}
  </button>;
}

/**
 * Muestra un resumen compacto y abre el diálogo con los controles de foto y Avatar Studio.
 * Headless UI gestiona foco, Escape, fondo inerte y retorno al botón que abrió el diálogo.
 * @param props.currentAvatarUrl URL privada de la foto vigente o null.
 * @param props.firstName Nombre para el monograma y texto accesible.
 * @param props.lastName Apellidos para el monograma y texto accesible.
 * @param props.hasAvatar Si el perfil tiene foto actualmente.
 * @param props.cleanupPending Si falta completar un borrado físico anterior.
 * @param props.errorMessage Error de la Server Action, que abre el diálogo para corregirlo.
 * @param props.uploadAction Server Action que recibe el campo multipart avatar.
 * @param props.removeAction Server Action que retira la imagen del titular autenticado.
 * @returns Resumen de foto y diálogo de edición adaptable a móvil.
 */
export function AvatarForm({ currentAvatarUrl, firstName, lastName, hasAvatar,
  cleanupPending = false, errorMessage = "", uploadAction, removeAction }) {
  const [isOpen, setIsOpen] = useState(Boolean(errorMessage));
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [clientError, setClientError] = useState("");

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  /** Cierra el diálogo y descarta el archivo local sin modificar la foto guardada. */
  function closeDialog() {
    setIsOpen(false);
    setPreviewUrl(null);
    setSelectedFile(null);
    setClientError("");
  }

  /**
   * Previsualiza un archivo admitido y descarta selecciones que superan el tamaño de subida.
   * @param event Evento change del selector de archivo.
   */
  function handleFileChange(event) {
    const file = event.currentTarget.files?.[0] ?? null;
    setSelectedFile(file);
    setPreviewUrl(null);
    setClientError("");
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      setClientError("La imagen supera el límite máximo de 2 MB.");
      return;
    }
    if (AVATAR_ALLOWED_MIME_TYPES.includes(file.type)) setPreviewUrl(URL.createObjectURL(file));
  }

  /**
   * Evita enviar archivos demasiado grandes; el servidor valida siempre contenido y permisos.
   * @param event Evento submit del formulario de subida.
   */
  function handleSubmit(event) {
    if (selectedFile && selectedFile.size > AVATAR_MAX_BYTES) {
      event.preventDefault();
      setClientError("La imagen supera el límite máximo de 2 MB.");
    }
  }

  return <>
    <div className="flex flex-wrap items-center gap-4">
      <ProfileAvatar size="md" decorative src={currentAvatarUrl} firstName={firstName} lastName={lastName} />
      <div className="grid min-w-0 flex-1 gap-3">
        <p className="text-[0.95rem]">Tu foto o avatar en la comunidad.</p>
        <button type="button" onClick={() => setIsOpen(true)} aria-haspopup="dialog" className={secondaryButtonClass + " w-fit"}>
          <Camera size={18} aria-hidden="true" />
          {hasAvatar ? "Editar foto" : cleanupPending ? "Gestionar foto" : "Añadir foto"}
        </button>
      </div>
    </div>

    <Dialog open={isOpen} onClose={closeDialog} className="fixed inset-0 z-[1100]">
      <DialogBackdrop transition className="fixed inset-0 bg-brand-ink/55 backdrop-blur-[2px] transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel data-testid="profile-photo-panel" transition className="relative w-full max-w-5xl rounded-xl border border-brand-line bg-brand-surface p-5 text-brand-ink shadow-xl transition duration-150 data-closed:translate-y-2 data-closed:opacity-0 motion-reduce:transition-none sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-brand-line pb-4">
              <div>
                <DialogTitle className="font-display text-xl uppercase text-brand-primary sm:text-2xl">Tu foto de perfil</DialogTitle>
                <Description className="mt-2 text-base">Elige una foto o crea tu avatar de Ad Astra.</Description>
              </div>
              <button type="button" onClick={closeDialog} aria-label="Cerrar ventana de foto"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-brand-line hover:bg-brand-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-8">
              <div className="grid min-w-0 gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <ProfileAvatar size="lg" decorative src={previewUrl || currentAvatarUrl} firstName={firstName} lastName={lastName} />
                  <p id="profile-avatar-help" className="min-w-0 flex-1 text-[0.95rem]">Opcional. JPEG, PNG o WebP hasta 2 MB.</p>
                </div>
                {(clientError || errorMessage) && <p className={portalAlertClassName} role="alert">{clientError || errorMessage}</p>}
                <form action={uploadAction} onSubmit={handleSubmit} className="grid min-w-0 gap-4">
                  <label htmlFor="profile-avatar-input" className="grid min-w-0 gap-2 font-bold">
                    Foto de perfil (JPEG, PNG o WebP, máx. 2 MB)
                    <input id="profile-avatar-input" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required
                      aria-describedby="profile-avatar-help" onChange={handleFileChange}
                      className="block w-full min-w-0 cursor-pointer rounded border border-brand-control bg-brand-surface px-3 py-2 text-sm font-normal text-brand-ink file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-brand-panel file:px-3 file:py-1.5 file:font-display file:text-xs file:uppercase file:text-brand-primary hover:file:bg-brand-soft/45" />
                  </label>
                  <div className="flex flex-wrap gap-3"><UploadSubmitButton hasAvatar={hasAvatar} /></div>
                </form>
                {(hasAvatar || cleanupPending) && <form action={removeAction} className="border-t border-brand-line pt-4"><RemoveSubmitButton hasAvatar={hasAvatar} /></form>}
              </div>
              <AvatarStudioBanner />
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  </>;
}
