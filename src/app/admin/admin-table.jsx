export function AdminTable({ label, headers, children }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="min-w-0 overflow-x-auto rounded-lg border border-brand-primary/40 focus-visible:outline-2 focus-visible:outline-brand-primary">
      <table className="w-full min-w-[610px] border-collapse text-left text-base [&_td]:border-t [&_td]:border-brand-primary/30 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_tbody_tr:nth-child(even)]:bg-brand-soft/20">
        <thead className="bg-brand-ink text-brand-surface"><tr>{headers.map((header) => <th scope="col" className="px-4 py-3" key={header}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
