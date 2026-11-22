import { Bookmark01Icon } from "@hugeicons/core-free-icons";
import { PortalIcon } from "./portal-ui";

export function BookmarkButton({ action, id, title, saved, returnTo }) {
  const label = saved ? "Retirar marcador" : "Guardar marcador";

  return (
    <form action={action}>
      <input type="hidden" name="opportunityId" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-label={`${label} · ${title}`}
        aria-pressed={saved}
        title={label}
        className="grid size-12 cursor-pointer place-items-center rounded-sm border border-brand-primary bg-brand-surface text-brand-primary transition-colors aria-pressed:bg-brand-soft/30 aria-pressed:text-brand-ink hover:bg-brand-soft/30 hover:text-brand-ink"
      >
        <PortalIcon
          icon={Bookmark01Icon}
          size={22}
          className={saved ? "[&_path]:fill-current" : ""}
        />
      </button>
    </form>
  );
}
