import Link from "next/link";
import { signOut } from "../lib/auth/session";

const linkClass =
  "inline-flex min-h-[44px] items-center py-2 text-brand-primary underline underline-offset-4 transition-colors hover:text-brand-ink";

const textButtonClass =
  "min-h-[44px] cursor-pointer border-0 bg-transparent py-2 text-left text-brand-primary underline underline-offset-4 transition-colors hover:text-brand-ink";

export function CommunityBar({ user }) {
  const hasAdmin = Array.isArray(user?.capabilities) && user.capabilities.length > 0;

  return (
    <aside
      className="border-t border-brand-primary/30 bg-brand-soft/20 print:hidden"
      aria-label="Sesión activa"
    >
      <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-x-6 px-6 py-1.5 text-[0.94rem] md:px-8">
        <p>
          <strong>{user.name}</strong> · <span>{user.email}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-6">
          {hasAdmin && (
            <Link href="/admin" className={linkClass}>
              Panel administrativo
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className={textButtonClass}>Cerrar sesión</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
