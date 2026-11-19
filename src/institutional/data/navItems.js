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
			{ label: "Tarjeta QR", href: "/qr-card" },
		],
		cta: { label: "Mi tarjeta QR", href: "/qr-card" },
	},
	organizer: {
		homeHref: "/home",
		links: [
			{ label: "Inicio", href: "/home" },
			{ label: "Actividades", href: "/activities" },
			{ label: "Gestión", href: "/admin" },
		],
		cta: { label: "Gestión", href: "/admin" },
	},
};

export function getCommunityNav(role) {
	return navigationByRole[role] ?? navigationByRole.visitor;
}

export default navigationByRole.visitor.links;
