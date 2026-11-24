const visitorNav = {
	homeHref: "/",
	links: [
		{ label: "Inicio", href: "/" },
		{ label: "Actividades", href: "/activities" },
		{ label: "Iniciar sesión", href: "/sign-in" },
	],
	cta: { label: "Crear cuenta", href: "/sign-up" },
};

const memberLinks = [
	{ label: "Inicio", href: "/home" },
	{ label: "Actividades", href: "/activities" },
	{ label: "Mis actividades", href: "/my-activities" },
	{ label: "Oportunidades", href: "/opportunities" },
	{ label: "Marcadores", href: "/bookmarks" },
	{ label: "Mi perfil", href: "/profile" },
];

export function getCommunityNav({ authenticated = false, hasAdmin = false } = {}) {
	if (!authenticated) {
		return visitorNav;
	}

	return {
		homeHref: "/home",
		links: hasAdmin
			? [...memberLinks, { label: "Gestión", href: "/admin" }]
			: memberLinks,
		cta: { label: "Mi tarjeta QR", href: "/qr-card" },
	};
}

export default visitorNav.links;
