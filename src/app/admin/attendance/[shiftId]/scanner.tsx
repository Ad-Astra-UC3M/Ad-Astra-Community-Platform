"use client";

import { useActionState, useEffect, useRef, useState } from "react";

type Controls = { stop(): void };

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
    let controls: Controls | undefined;
    async function scan() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (closed || !video.current) return;
        controls = await new BrowserQRCodeReader().decodeFromConstraints(
          {video: {facingMode: {ideal: "environment"}}, audio: false},
          video.current,
          (code, _error, scanner) => {
            if (closed || !code || !input.current) return;
            closed = true;
            scanner.stop();
            input.current.value = code.getText();
            setActive(false);
            form.current?.requestSubmit();
          }
        );
        if (closed) controls.stop();
      } catch {
        if (!closed) {
          setCameraError("No se pudo abrir la cámara. Puedes pegar el código de la tarjeta.");
          setActive(false);
        }
      }
    }
    void scan();
    return () => { closed = true; controls?.stop(); };
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
