export const pageClassName =
  "mx-auto grid w-full max-w-[80rem] gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12 lg:pb-20";

export function PageHeading({ title, description, actions, className = "" }) {
  return (
    <header className={`flex min-w-0 flex-col gap-4 border-b border-brand-line pb-5 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="grid min-w-0 gap-2">
        <h1>{title}</h1>
        {description && <p className="max-w-[68ch]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
