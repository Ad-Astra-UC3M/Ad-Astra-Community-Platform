/**
 * @file Barra inferior de accesos rápidos para miembros en pantallas estrechas. Mantiene visibles los cinco
 * destinos principales del portal, que en escritorio ya muestra la barra superior.
 */

import {
	Briefcase01Icon,
	Calendar03Icon,
	Home01Icon,
	Ticket01Icon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { NavLink } from "./NavLink";

const icons = {
	home: Home01Icon,
	activities: Calendar03Icon,
	reservations: Ticket01Icon,
	opportunities: Briefcase01Icon,
	profile: UserIcon,
};

const linkClassName =
	"flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-center text-[0.72rem] leading-tight transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary";

const activeLinkClassName = "font-bold text-brand-primary";

/**
 * Renderiza la barra fija inferior. Se oculta desde 890 px, donde la barra superior muestra los enlaces, y al
 * imprimir. Queda por debajo de los diálogos (`z-[1100]`) y de la barra superior.
 *
 * @param props.links Accesos de `getCommunityNav().bottomLinks`, con `icon` como clave de pictograma.
 * @param props.activeHref Destino activo calculado con `findActiveHref`, o null.
 * @returns Navegación `<nav>` con los accesos rápidos.
 */
export function MemberBottomNav({ links, activeHref }) {
	return (
		<nav
			aria-label="Accesos rápidos"
			className="fixed inset-x-0 bottom-0 z-[998] border-t border-brand-line bg-astra-cream pb-[env(safe-area-inset-bottom)] min-[890px]:hidden print:hidden"
		>
			<ul className="mx-auto grid max-w-xl grid-cols-5">
				{links.map(({ label, href, icon }) => {
					const active = href === activeHref;
					return (
						<li key={href} className="min-w-0">
							<NavLink
								href={href}
								active={active}
								className={linkClassName}
								activeClassName={activeLinkClassName}
								inactiveClassName="text-brand-ink"
							>
								<HugeiconsIcon
									icon={icons[icon]}
									size={22}
									strokeWidth={active ? 2.2 : 1.8}
									aria-hidden="true"
									focusable="false"
								/>
								<span className="max-w-full [overflow-wrap:anywhere]">{label}</span>
							</NavLink>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
