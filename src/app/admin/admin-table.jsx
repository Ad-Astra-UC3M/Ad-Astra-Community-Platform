/**
 * @file Tabla administrativa desplazable y accesible para listados de gestión. Combina encabezados en tinta,
 * bordes institucionales y filas alternas suaves de la paleta unificada.
 */

/**
 * Envuelve filas `<tr>` dentro de una región desplazable accesible por teclado.
 * @param props Propiedades de la tabla administrativa.
 * @param props.label Nombre accesible de la región de la tabla.
 * @param props.headers Títulos de las columnas en `<th scope="col">`.
 * @param props.children Elementos `<tr>` del cuerpo de la tabla.
 * @returns Contenedor desplazable `role="region"` con encabezados en tinta y filas alternas.
 */
export function AdminTable({ label, headers, children }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="min-w-0 overflow-x-auto rounded-lg border border-brand-line bg-brand-surface focus-visible:outline-2 focus-visible:outline-brand-primary"
    >
      <table className="w-full min-w-[610px] border-collapse text-left text-base [&_td]:border-t [&_td]:border-brand-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td]:[overflow-wrap:anywhere] [&_tbody_tr:nth-child(even)]:bg-brand-panel">
        <thead className="bg-brand-ink text-brand-surface">
          <tr>
            {headers.map((header) => (
              <th scope="col" className="px-4 py-3 font-serif font-bold" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
