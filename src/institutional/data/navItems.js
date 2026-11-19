const navigationByRole = {
	visitor: {
		homeHref: "/",
		links: [
			{ label: "Inicio", href: "/" },
			{ label: "Actividades", href: "/activities" },
			{ label: "Iniciar sesión", href: "/sign-in" },
		],
		cta: { label: "Crear cuenta", href: "/sign-up" },
	},
	student: {
		homeHref: "/home",
		links: [
			{ label: "Inicio", href: "/home" },
			{ label: "Actividades", href: "/activities" },
			{ label: "Mis actividades", href: "/my-activities" },
			{ label: "Oportunidades", href: "/opportunities" },
			{ label: "Marcadores", href: "/bookmarks" },
			{ label: "Mi perfil", href: "/profile" },
		],
		cta: { label: "Mi tarjeta QR", href: "/qr-card" },
	},
	organizer: {
		homeHref: "/home",
		links: [
			{ label: "Inicio", href: "/home" },
			{ label: "Actividades", href: "/activities" },
			{ label: "Oportunidades", href: "/opportunities" },
			{ label: "Marcadores", href: "/bookmarks" },
			{ label: "Mi perfil", href: "/profile" },
			{ label: "Gestión", href: "/admin" },
		],
		cta: { label: "Gestión", href: "/admin" },
	},
};

export function getCommunityNav(role) {
	return navigationByRole[role] ?? navigationByRole.visitor;
}

export default navigationByRole.visitor.links;
