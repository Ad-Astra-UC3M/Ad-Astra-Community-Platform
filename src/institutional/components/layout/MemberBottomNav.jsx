/**
 * @file Barra inferior de accesos rápidos para miembros en pantallas estrechas. Mantiene visibles los cinco
 * destinos más usados en el móvil, con la tarjeta QR en el centro. Los pictogramas son Hugeicons animados de
 * Animate UI (y un QR propio con sus primitivas) que se animan al pasar el puntero o tocar el acceso.
 */

import { AnimateIcon } from "@animate-ui/react/icons";
import { Calendar } from "../../../components/animate-ui/icons/hugeicons/calendar";
import { Home03 } from "../../../components/animate-ui/icons/hugeicons/home-03";
import { QrCode } from "../../../components/animate-ui/icons/hugeicons/qr-code";
import { Rocket01 } from "../../../components/animate-ui/icons/hugeicons/rocket-01";
import { User } from "../../../components/animate-ui/icons/hugeicons/user";
import { NavLink } from "./NavLink";

const icons = {
	home: Home03,
	activities: Calendar,
	qr: QrCode,
	opportunities: Rocket01,
	profile: User,
};

// Las etiquetas usan la sans del sistema a 12 px y en una línea: la Bodoni institucional pierde los trazos finos a
// tamaños tan pequeños.
const linkClassName =
	"relative flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-center transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary";

// El activo no cambia de grosor: la negrita desbordaría «Actividades» en un hueco de 60 px. Lo distinguen el
// color, el trazo del icono y la barra superior.
const activeLinkClassName = "text-brand-primary";

/**
 * Renderiza la barra fija inferior. Se oculta desde 1080 px, donde la barra superior muestra los enlaces, y al
 * imprimir. Queda por debajo de los diálogos (`z-[1100]`) y de la barra superior. Con movimiento reducido,
 * Animate UI no anima los iconos.
 *
 * @param props.links Accesos de `getCommunityNav().bottomLinks`, con `icon` como clave de pictograma.
 * @param props.activeHref Destino activo calculado con `findActiveHref`, o null.
 * @returns Navegación `<nav>` con los accesos rápidos.
 */
export function MemberBottomNav({ links, activeHref }) {
	return (
		<nav
			aria-label="Accesos rápidos"
			className="fixed inset-x-0 bottom-0 z-[998] border-t border-brand-control bg-astra-cream shadow-[0_-2px_8px_rgba(39,41,92,0.08)] pb-[env(safe-area-inset-bottom)] min-[1080px]:hidden print:hidden"
		>
			<ul className="mx-auto grid max-w-xl grid-cols-5">
				{links.map(({ label, href, icon }) => {
					const active = href === activeHref;
					const Icon = icons[icon];
					return (
						<li key={href} className="min-w-0">
							<AnimateIcon animateOnHover animateOnTap completeOnStop asChild>
								<NavLink
									href={href}
									active={active}
									className={linkClassName}
									activeClassName={activeLinkClassName}
									inactiveClassName="text-brand-ink"
								>
									<Icon
										size={22}
										strokeWidth={active ? 2.2 : 1.8}
										aria-hidden="true"
										focusable="false"
									/>
									{/* Marca no cromática del activo: una barra sobre el icono, además del color y el trazo del icono. */}
									{active && (
										<span
											data-active-indicator
											aria-hidden="true"
											className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-brand-primary"
										/>
									)}
									<span className="whitespace-nowrap font-sans text-xs leading-tight">{label}</span>
								</NavLink>
							</AnimateIcon>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
