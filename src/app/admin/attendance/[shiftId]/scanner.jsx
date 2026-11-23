/**
 * @file Componente cliente del control de asistencia. Captura un QR por cámara o permite pegar el token
 * y envía el formulario para su validación en el servidor.
 */

"use client";

import { Camera01Icon, QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useActionState, useEffect, useRef, useState } from "react";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../../components/form-styles";
import { portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../../../components/portal-ui";
import TextSpanWrapper2 from "../../../../institutional/components/ui/TextSpanWrapper2";

/**
 * `AttendancePage` monta el lector con una Server Action vinculada al turno. Usa `useActionState` para
 * mostrar el resultado y bloquear el envío mientras está pendiente.
 * @param props Datos que recibe el lector desde la página de turno.
 * @param props.action Acción que recibe el estado previo y el formulario con `token` y devuelve el
 * nuevo mensaje.
 * @returns El lector de cámara y el formulario manual con su estado de validación.
 */
export function Scanner({ action }) {
  const [result, submit, pending] = useActionState(action, "");
  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const video = useRef(null);
  const input = useRef(null);
  const form = useRef(null);

  useEffect(() => {
    if (!active) return;
    let closed = false;
    let stream;
    let timer;
    const preview = video.current;
    /**
     * La limpieza del efecto y `scan` llaman a este helper para liberar las pistas de cámara, cancelar
     * el temporizador y desconectar el vídeo.
     */
    function stop() {
      stream?.getTracks().forEach((track) => track.stop());
      if (timer) clearTimeout(timer);
      if (preview) preview.srcObject = null;
    }
    /**
     * El efecto de `Scanner` abre la cámara cuando el lector está activo. Importa `jsqr` bajo demanda,
     * inicia el vídeo y prepara el lienzo para `readFrame`. Si falla, muestra la opción de pegar el
     * token.
     */
    async function scan() {
      try {
        const { default: decode } = await import("jsqr");
        if (closed || !preview) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (closed) {
          stop();
          return;
        }
        preview.srcObject = stream;
        await preview.play();
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        /**
         * `scan` inicia este ciclo de lectura en el navegador. Captura un fotograma del vídeo, lo
         * decodifica con `jsqr` y envía el formulario al obtener un código. Si necesita otra lectura,
         * programa el siguiente fotograma.
         */
        function readFrame() {
          if (closed || !preview) return;
          if (preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const scale = Math.min(1, 960 / Math.max(preview.videoWidth, preview.videoHeight));
            canvas.width = Math.round(preview.videoWidth * scale);
            canvas.height = Math.round(preview.videoHeight * scale);
            context.drawImage(preview, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: "dontInvert" });
            if (code && input.current) {
              input.current.value = code.data;
              setActive(false);
              form.current?.requestSubmit();
              return;
            }
          }
          timer = setTimeout(readFrame, 180);
        }
        readFrame();
      } catch {
        if (!closed) {
          setCameraError("No se pudo abrir la cámara. Puedes pegar el código de la tarjeta.");
          setActive(false);
        }
      }
    }
    void scan();
    return () => {
      closed = true;
      stop();
    };
  }, [active]);

  return (
    <section className={portalPanelClassName}>
      <h2 className="flex items-center gap-2 border-b border-brand-line pb-2.5">
        <HugeiconsIcon icon={QrCodeIcon} size={20} aria-hidden="true" className="shrink-0 text-brand-primary" />
        <TextSpanWrapper2 as="span" className="min-w-0">
          Leer tarjeta
        </TextSpanWrapper2>
      </h2>
      <button
        type="button"
        className={secondaryButtonClass + " disabled:cursor-default disabled:border-brand-line disabled:bg-brand-panel disabled:text-brand-ink"}
        disabled={pending}
        onClick={() => {
          setCameraError("");
          setActive(!active);
        }}
      >
        <HugeiconsIcon icon={Camera01Icon} size={18} aria-hidden="true" className="shrink-0" />
        {active ? "Cerrar cámara" : "Abrir cámara"}
      </button>
      {active && (
        <div className="grid gap-2">
          <div className="relative grid w-full max-w-lg place-items-center overflow-hidden rounded-lg bg-brand-ink p-2">
            <video
              ref={video}
              muted
              playsInline
              aria-label="Vista de cámara"
              className="aspect-video w-full object-contain"
            />
            <span aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-5 border-t-2 border-s-2 border-brand-surface/80" />
            <span aria-hidden="true" className="pointer-events-none absolute top-3 right-3 size-5 border-t-2 border-e-2 border-brand-surface/80" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 size-5 border-b-2 border-s-2 border-brand-surface/80" />
            <span aria-hidden="true" className="pointer-events-none absolute right-3 bottom-3 size-5 border-e-2 border-b-2 border-brand-surface/80" />
            <div aria-hidden="true" className="pointer-events-none absolute aspect-square w-2/5 max-w-44 rounded-sm border-2 border-brand-accent" />
          </div>
          <p className="text-[0.95rem]">Centra el código QR en el recuadro amarillo.</p>
        </div>
      )}
      {cameraError && (
        <p className={portalAlertClassName} role="alert">
          {cameraError}
        </p>
      )}
      <form className="grid min-w-0 gap-4 border-t border-brand-line pt-4" action={submit} ref={form}>
        <p>También puedes introducir el código manualmente.</p>
        <label className="grid min-w-0 gap-1.5 font-bold">
          Código de la tarjeta
          <textarea
            className={inputClass + " min-h-[5.5rem] resize-y"}
            required
            name="token"
            maxLength={2048}
            ref={input}
            rows={3}
          />
        </label>
        <button
          className={primaryButtonClass + " disabled:cursor-default disabled:border-brand-line disabled:bg-brand-panel disabled:text-brand-ink"}
          disabled={pending}
        >
          {pending ? "Validando…" : "Validar tarjeta"}
        </button>
      </form>
      <p
        className={portalFeedbackClassName + " empty:hidden"}
        role="status"
        aria-live="polite"
      >
        {result}
      </p>
    </section>
  );
}
