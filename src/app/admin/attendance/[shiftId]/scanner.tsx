"use client";

import { useActionState, useEffect, useRef, useState } from "react";



export function Scanner({action}: {action: (previous: string, form: FormData) => Promise<string>}) {
  const [result, submit, pending] = useActionState(action, "");
  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!active) return;
    let closed = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const preview = video.current;
    function stop() {
      stream?.getTracks().forEach(track => track.stop());
      if (timer) clearTimeout(timer);
      if (preview) preview.srcObject = null;
    }
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
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
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

  return <section className="panel stack scanner">
    <h2>Leer tarjeta</h2>
    <button type="button" className="button secondary" disabled={pending} onClick={() => {
      setCameraError("");
      setActive(!active);
    }}>{active ? "Cerrar cámara" : "Abrir cámara"}</button>
    {active && <video ref={video} muted playsInline aria-label="Vista de cámara" style={{maxWidth:"100%"}} />}
    {cameraError && <p role="alert">{cameraError}</p>}
    <form className="stack" action={submit} ref={form}>
      <label className="field">Código de la tarjeta
        <textarea required name="token" maxLength={2048} ref={input} rows={3} />
      </label>
      <button className="button" disabled={pending}>{pending ? "Validando…" : "Validar tarjeta"}</button>
    </form>
    <p role="status" aria-live="polite">{result}</p>
  </section>;
}
