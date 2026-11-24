/**
 * @file Componente cliente del control de asistencia. Captura un QR por cámara o permite pegar el token
 * y envía el formulario para su validación en el servidor.
 */

"use client";

import { useActionState, useEffect, useRef, useState } from "react";



/**
 * `AttendancePage` monta el lector con una Server Action vinculada al turno. Usa `useActionState` para
 * mostrar el resultado y bloquear el envío mientras está pendiente.
 * @param props Datos que recibe el lector desde la página de turno.
 * @param props.action Acción que recibe el estado previo y el formulario con `token` y devuelve el
 * nuevo mensaje.
 * @returns El lector de cámara y el formulario manual con su estado de validación.
 */
export function Scanner({action}) {
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
      stream?.getTracks().forEach(track => track.stop());
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
          video: { facingMode: { ideal: "environment" } }, audio: false
        });
        if (closed) { stop(); return; }
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
    return () => { closed = true; stop(); };
  }, [active]);

  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
      <h2>Leer tarjeta</h2>
      <button
        type="button"
        className="inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink"
        disabled={pending}
        onClick={() => {
          setCameraError("");
          setActive(!active);
        }}
      >
        {active ? "Cerrar cámara" : "Abrir cámara"}
      </button>
      {active && (
        <video
          ref={video}
          muted
          playsInline
          aria-label="Vista de cámara"
          className="block w-full max-w-[32rem] rounded-[4px]"
        />
      )}
      {cameraError && (
        <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
          {cameraError}
        </p>
      )}
      <form className="grid min-w-0 gap-4" action={submit} ref={form}>
        <label className="grid min-w-0 gap-1.5 font-bold">
          Código de la tarjeta
          <textarea
            className="min-h-12 w-full min-w-0 resize-y rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink"
            required
            name="token"
            maxLength={2048}
            ref={input}
            rows={3}
          />
        </label>
        <button
          className="inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink"
          disabled={pending}
        >
          {pending ? "Validando…" : "Validar tarjeta"}
        </button>
      </form>
      <p
        className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink empty:hidden"
        role="status"
        aria-live="polite"
      >
        {result}
      </p>
    </section>
  );
}
