/**
 * @file Enlace de navegación de Comunidad que anuncia la página actual con `aria-current` y aplica un estilo
 * activo. Lo comparten la barra institucional, el menú móvil, el menú de cuenta y la barra inferior.
 */

import Link from "next/link";

/**
 * Renderiza un `next/link` y, si representa la ruta actual, añade `aria-current="page"` y la clase activa.
 *
 * @param props.href Destino interno.
 * @param props.active Indica si el enlace corresponde a la ruta actual (ver `findActiveHref`).
 * @param props.className Clases comunes del enlace.
 * @param props.activeClassName Clases añadidas cuando el enlace está activo.
 * @param props.inactiveClassName Clases añadidas cuando no lo está; evita que dos colores compitan en Tailwind.
 * @param props.children Contenido visible del enlace.
 * @returns Enlace accesible con el estado de página actual.
 */
export function NavLink({
	href,
	active = false,
	className = "",
	activeClassName = "",
	inactiveClassName = "",
	children,
	...props
}) {
	const stateClassName = active ? activeClassName : inactiveClassName;
	return (
		<Link
			href={href}
			aria-current={active ? "page" : undefined}
			className={stateClassName ? `${className} ${stateClassName}` : className}
			{...props}
		>
			{children}
		</Link>
	);
}
