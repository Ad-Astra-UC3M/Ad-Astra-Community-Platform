"use client";

/**
 * @file Adaptador cliente de la barra inferior móvil. RootLayout lo monta después del pie para que el orden de
 * tabulación coincida con su posición en pantalla; aquí se resuelve la ruta activa con `usePathname`.
 */

import { usePathname } from "next/navigation";
import { findActiveHref, getCommunityNav } from "../../data/navItems";
import { MemberBottomNav } from "./MemberBottomNav";

const { bottomLinks } = getCommunityNav({ authenticated: true });

/**
 * Renderiza los accesos rápidos de miembro con la entrada de la ruta actual marcada.
 *
 * @returns Barra inferior de `MemberBottomNav`.
 */
export function CommunityBottomNav() {
	const pathname = usePathname();
	return <MemberBottomNav links={bottomLinks} activeHref={findActiveHref(pathname, bottomLinks)} />;
}
