/**
 * @file Barra de usuario autenticado que incluye RootLayout. Usa el usuario resuelto para mostrar la sesión
 * y enlaza el formulario al cierre de sesión del servidor.
 */

import { DashboardSquare01Icon, Logout03Icon, UserIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { signOut } from "../app/auth-actions";
import { buildOwnAvatarUrl } from "../server/profiles/avatar-validation";
import { PortalIcon } from "./portal-ui";
import { ProfileAvatar } from "./profile-avatar";

const linkClass =
  "inline-flex min-h-[44px] items-center gap-1.5 py-2 text-brand-primary underline underline-offset-4 transition-colors hover:text-brand-ink";

const textButtonClass =
  "inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 border-0 bg-transparent py-2 text-left text-brand-primary underline underline-offset-4 transition-colors hover:text-brand-ink";

/**
 * Muestra nombre, correo y acceso al panel si corresponde. El formulario invoca signOut.
 *
 * @param props Propiedades de la barra de sesión.
 * @param props.user Usuario que entrega RootLayout después de resolver su sesión y capacidades.
 * @returns Franja `<aside>` con la identidad de la sesión, enlace administrativo y botón de cierre.
 */
export function CommunityBar({ user }) {
  const hasAdmin = Array.isArray(user?.capabilities) && user.capabilities.length > 0;
  const avatarUrl = buildOwnAvatarUrl(user?.avatarUpdatedAt);

  return (
    <aside
      className="border-t border-b border-brand-line bg-brand-panel text-brand-ink print:hidden"
      aria-label="Sesión activa"
    >
      <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-x-6 px-4 py-1 text-[0.94rem] sm:px-6 lg:px-8">
        <p className="inline-flex min-w-0 items-center gap-2 py-1 [overflow-wrap:anywhere]">
          {avatarUrl ? (
            <ProfileAvatar size="xs" decorative src={avatarUrl} name={user.name} />
          ) : (
            <PortalIcon icon={UserIcon} size={16} className="text-brand-primary" />
          )}
          <span>
            <strong>{user.name}</strong> · <span>{user.email}</span>
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-x-5">
          {hasAdmin && (
            <Link href="/admin" className={linkClass}>
              <PortalIcon icon={DashboardSquare01Icon} size={16} />
              Panel administrativo
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className={textButtonClass}>
              <PortalIcon icon={Logout03Icon} size={16} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
