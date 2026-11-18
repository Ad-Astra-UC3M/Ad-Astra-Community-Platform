"use client";

export function CardTools({ token }: { token: string }) {
  return <div className="stack card-tools">
    <button className="button secondary" onClick={() => window.print()}>Imprimir tarjeta</button>
    <details>
      <summary>Usar el código sin cámara</summary>
      <label className="field">Código de la tarjeta
        <textarea readOnly rows={3} value={token} onFocus={event => event.target.select()} />
      </label>
      <p>Copia este código para probar la validación desde el panel de organización.</p>
    </details>
  </div>;
}
