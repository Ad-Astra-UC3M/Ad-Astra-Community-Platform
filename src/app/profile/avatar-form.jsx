/**
 * @file Controles interactivos de cliente para subir, previsualizar y retirar la foto de perfil
 * privada en `/profile`. Valida únicamente tamaños excesivos en cliente antes de delegar en las
 * Server Actions autorizadas.
 */

"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { primaryButtonClass, secondaryButtonClass } from "../../components/form-styles";
import { portalAlertClassName } from "../../components/portal-ui";
import { ProfileAvatar } from "../../components/profile-avatar";
import { AVATAR_ALLOWED_MIME_TYPES } from "../../server/profiles/avatar-validation";

const CLIENT_UPLOAD_GUARD_BYTES = 2_500_000;

/**
 * Botón principal del formulario de subida con estado de carga reflejado mediante `useFormStatus`.
 *
 * @param props - Estado actual del avatar para ajustar el texto de acción.
 * @param props.hasAvatar - Indica si la cuenta ya tiene una foto guardada.
 * @returns Botón de envío estilizado del formulario de subida.
 */
function UploadSubmitButton({ hasAvatar }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryButtonClass}>
      {pending ? "Guardando foto…" : hasAvatar ? "Cambiar foto" : "Guardar foto"}
    </button>
  );
}

/**
 * Botón secundario para retirar la foto actual desde un formulario independiente.
 *
 * @returns Botón de borrado con indicador visual mientras dura la Server Action.
 */
function RemoveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={secondaryButtonClass}>
      {pending ? "Quitando foto…" : "Quitar foto"}
    </button>
  );
}

/**
 * Renderiza la vista previa de foto o iniciales, el selector de imagen (`JPEG`, `PNG` o `WebP`), la
 * comprobación previa ante archivos demasiado grandes (> 2,5 MB) y el botón opcional de retirada.
 *
 * @param props - Estado del perfil actual y acciones del servidor.
 * @param props.currentAvatarUrl - URL privada vigente de la foto o `null`.
 * @param props.firstName - Nombre de pila para el monograma y el atributo `alt`.
 * @param props.lastName - Apellidos para el monograma y el atributo `alt`.
 * @param props.hasAvatar - Determina si se muestra «Quitar foto» y «Cambiar foto».
 * @param props.uploadAction - Server Action que procesa `FormData` con el campo `avatar`.
 * @param props.removeAction - Server Action que retira la foto actual de PostgreSQL y Neon Storage.
 * @returns Bloque interactivo de gestión de foto de perfil.
 */
export function AvatarForm({
  currentAvatarUrl,
  firstName,
  lastName,
  hasAvatar,
  uploadAction,
  removeAction,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /**
   * Actualiza la vista previa local cuando el usuario escoge un archivo y limpia errores previos.
   *
   * @param event - Evento `change` del input de tipo archivo.
   */
  function handleFileChange(event) {
    const file = event.currentTarget.files?.[0] ?? null;
    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setPreviewUrl(null);
      setClientError("");
      return;
    }

    if (file.size > CLIENT_UPLOAD_GUARD_BYTES) {
      setPreviewUrl(null);
      setClientError("La imagen supera el límite máximo de 2 MB.");
      return;
    }

    setClientError("");
    setPreviewUrl(
      AVATAR_ALLOWED_MIME_TYPES.includes(file.type)
        ? URL.createObjectURL(file)
        : null,
    );
  }

  /**
   * Evita enviar cargas muy superiores a 2,5 MB contra el límite de Next.js mostrando un aviso local.
   *
   * @param event - Evento de envío del formulario de subida.
   */
  function handleSubmit(event) {
    if (selectedFile && selectedFile.size > CLIENT_UPLOAD_GUARD_BYTES) {
      event.preventDefault();
      setClientError("La imagen supera el límite máximo de 2 MB.");
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <ProfileAvatar
          size="md"
          decorative
          src={previewUrl || currentAvatarUrl}
          firstName={firstName}
          lastName={lastName}
        />
        <p id="profile-avatar-help" className="min-w-0 flex-1 text-[0.95rem]">
          Opcional. Formatos JPEG, PNG o WebP hasta 2 MB. Se almacena de forma privada en tu cuenta.
        </p>
      </div>

      {clientError && (
        <p className={portalAlertClassName} role="alert">
          {clientError}
        </p>
      )}

      <form action={uploadAction} onSubmit={handleSubmit} className="grid min-w-0 gap-3">
        <label htmlFor="profile-avatar-input" className="grid min-w-0 gap-1.5 font-bold">
          Foto de perfil (JPEG, PNG o WebP, máx. 2 MB)
          <input
            id="profile-avatar-input"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            aria-describedby="profile-avatar-help"
            onChange={handleFileChange}
            className="block w-full min-w-0 cursor-pointer rounded-[4px] border border-brand-control bg-brand-surface px-3 py-2 text-sm font-normal text-brand-ink file:mr-3 file:cursor-pointer file:rounded-[4px] file:border-0 file:bg-brand-panel file:px-3 file:py-1.5 file:font-display file:text-xs file:uppercase file:text-brand-primary hover:file:bg-brand-soft/45"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <UploadSubmitButton hasAvatar={hasAvatar} />
        </div>
      </form>

      {hasAvatar && (
        <form action={removeAction} className="border-t border-brand-line pt-3">
          <RemoveSubmitButton />
        </form>
      )}
    </div>
  );
}
