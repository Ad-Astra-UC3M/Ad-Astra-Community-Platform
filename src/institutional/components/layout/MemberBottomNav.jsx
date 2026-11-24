/**
 * @file Barra inferior de accesos rápidos para miembros en pantallas estrechas. Mantiene visibles los cinco
 * destinos principales del portal, que en escritorio ya muestra la barra superior. Los pictogramas son los
 * Hugeicons animados de Animate UI y se animan al pasar el puntero o tocar el acceso.
 */

import { AnimateIcon } from "@animate-ui/react/icons";
import { Calendar } from "../../../components/animate-ui/icons/hugeicons/calendar";
import { CalendarCheck } from "../../../components/animate-ui/icons/hugeicons/calendar-check";
import { Home03 } from "../../../components/animate-ui/icons/hugeicons/home-03";
import { Rocket01 } from "../../../components/animate-ui/icons/hugeicons/rocket-01";
import { User } from "../../../components/animate-ui/icons/hugeicons/user";
import { NavLink } from "./NavLink";

const icons = {
	home: Home03,
	activities: Calendar,
	reservations: CalendarCheck,
	opportunities: Rocket01,
	profile: User,
};

const linkClassName =
	"flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-center text-[clamp(0.62rem,3.1vw,0.72rem)] leading-tight tracking-tight transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary";

const activeLinkClassName = "font-bold text-brand-primary";

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
			className="fixed inset-x-0 bottom-0 z-[998] border-t border-brand-line bg-astra-cream pb-[env(safe-area-inset-bottom)] min-[1080px]:hidden print:hidden"
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
									<span className="max-w-full break-words hyphens-auto">{label}</span>
								</NavLink>
							</AnimateIcon>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
