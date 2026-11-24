/**
 * @file Modelo de navegación de Comunidad según la sesión. La barra institucional, el menú móvil, el menú de
 * cuenta y la barra inferior consumen estas listas, y `findActiveHref` decide qué entrada marca la ruta actual.
 */

const visitorNav = {
	homeHref: "/",
	links: [{ label: "Acceder", href: "/sign-in" }],
	cta: { label: "Crear cuenta", href: "/sign-up" },
	accountLinks: [],
	bottomLinks: [],
};

const memberLinks = [
	{ label: "Inicio", href: "/home" },
	{ label: "Actividades", href: "/activities" },
	{ label: "Mis actividades", href: "/my-activities" },
	{ label: "Oportunidades", href: "/opportunities" },
	{ label: "Marcadores", href: "/bookmarks" },
];

const memberAccountLinks = [
	{ label: "Mi perfil", href: "/profile" },
	{ label: "Difusión y privacidad", href: "/profile/privacy" },
];

// La tarjeta QR ocupa el centro de la barra inferior porque es el acceso que se necesita en la puerta de una
// actividad (RF-12/RF-13). «Mis actividades» sigue en la barra superior y en el menú móvil. «Ofertas» abrevia
// «Oportunidades» solo aquí: con 12 px, la palabra completa no cabe en un hueco de 320 px de ancho.
const memberBottomLinks = [
	{ label: "Inicio", href: "/home", icon: "home" },
	{ label: "Actividades", href: "/activities", icon: "activities" },
	{ label: "Tarjeta QR", href: "/qr-card", icon: "qr" },
	{ label: "Ofertas", href: "/opportunities", icon: "opportunities" },
	{ label: "Mi perfil", href: "/profile", icon: "profile" },
];

const adminLink = { label: "Panel administrativo", href: "/admin" };

/**
 * Devuelve la navegación que corresponde a la sesión. Sin sesión solo se ofrecen acceso y registro, porque
 * los listados exigen una cuenta (RF-04). Con sesión, el panel administrativo aparece una única vez, en el
 * menú de cuenta, y solo si la cuenta tiene alguna capacidad interna.
 *
 * @param options.authenticated Indica si RootLayout resolvió una sesión activa y verificada.
 * @param options.hasAdmin Indica si la cuenta tiene al menos una capacidad interna.
 * @returns Logotipo, enlaces principales, llamada a la acción, enlaces de cuenta y barra inferior móvil.
 */
export function getCommunityNav({ authenticated = false, hasAdmin = false } = {}) {
	if (!authenticated) {
		return visitorNav;
	}

	return {
		homeHref: "/home",
		links: memberLinks,
		cta: { label: "Mi tarjeta QR", href: "/qr-card" },
		accountLinks: hasAdmin ? [...memberAccountLinks, adminLink] : memberAccountLinks,
		bottomLinks: memberBottomLinks,
	};
}

/**
 * Elige la entrada que representa la ruta actual dentro de una lista. Una entrada coincide con su ruta exacta
 * o con sus subrutas (`/activities/x` activa `/activities`); se elige la más específica para que
 * `/profile/privacy` no marque también `/profile`. La portada y `/home` solo coinciden de forma exacta.
 *
 * @param pathname Ruta que entrega `usePathname`, o null antes de conocerla.
 * @param items Entradas con `href` interno.
 * @returns El `href` activo o null si ninguna entrada corresponde a la ruta.
 */
export function findActiveHref(pathname, items) {
	if (!pathname) return null;
	let active = null;
	for (const { href } of items) {
		const exactOnly = href === "/" || href === "/home";
		const matches = pathname === href || (!exactOnly && pathname.startsWith(href + "/"));
		if (matches && (active === null || href.length > active.length)) active = href;
	}
	return active;
}

export default visitorNav.links;
