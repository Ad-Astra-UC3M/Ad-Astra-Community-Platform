import { AnimateIcon } from "@animate-ui/react/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

import HamburgerMenu from "../ui/HamburgerMenu";
import navItems, { findActiveHref, getCommunityNav } from "../../data/navItems";
import LogoMark from "../../assets/navbar-logo.svg";
import NavDropdown from "./NavDropdown";
import { AccountMenu } from "./AccountMenu";
import { NavLink } from "./NavLink";
import { Logout01 } from "../../../components/animate-ui/icons/hugeicons/logout-01";
import { ProfileAvatar } from "../../../components/profile-avatar";
import { signOut } from "../../../app/auth-actions";
import { useEffect, useState, useRef } from "react";

const navLinkClassName =
	"inline-flex items-center whitespace-nowrap px-2.5 py-2 font-normal underline-offset-6 transition duration-200 hover:text-brand-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent";

const activeNavLinkClassName = "font-bold text-brand-primary underline decoration-2";

/**
 * Barra institucional de Comunidad. Muestra la navegación según la sesión, marca la sección actual y, con
 * sesión, añade el menú de cuenta en escritorio y la identidad y el cierre de sesión en el menú móvil.
 *
 * @param props.authenticated Indica si RootLayout resolvió una sesión activa y verificada.
 * @param props.hasAdmin Indica si la cuenta tiene alguna capacidad interna.
 * @param props.account Nombre, correo y URL privada del avatar de la sesión, o null sin sesión.
 * @returns Encabezado fijo. La barra inferior móvil la monta RootLayout después del pie (`CommunityBottomNav`).
 */
export default function Navbar({ authenticated = false, hasAdmin = false, account = null }) {
	const { homeHref, links, cta, accountLinks } = getCommunityNav({ authenticated, hasAdmin });
	const pathname = usePathname();
	const activeLink = findActiveHref(pathname, links);
	const activeAccountLink = findActiveHref(pathname, accountLinks);
	const activeMobileLink = findActiveHref(pathname, [...links, ...accountLinks]);
	const signedIn = authenticated && account;
	const [hidden, setHidden] = useState(false);
	const headerRef = useRef(null);
	const preventHide = useRef(false);
	const unlockTimer = useRef(null);

	const handleNavigationClick = (event) => {
		if (!event.target.closest?.('a[href*="#"]')) return;

		preventHide.current = true;
		setHidden(false);

		clearTimeout(unlockTimer.current);
		unlockTimer.current = setTimeout(() => {
			preventHide.current = false;
		}, 2000);
	};

	const lastScrollY = useRef(0);

	useEffect(() => {
		const onScroll = () => {
			const currentY = window.scrollY;
			const delta = currentY - lastScrollY.current;

			if (preventHide.current || hasKeyboardFocusInside(headerRef.current)) {
				lastScrollY.current = currentY;
				setHidden(false);
				return;
			}

			if (currentY < 100) {
				setHidden(false);
			} else if (delta > 4) {
				setHidden(true);
			} else if (delta < -4) {
				setHidden(false);
			}

			lastScrollY.current = currentY;
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			clearTimeout(unlockTimer.current);
			window.removeEventListener("scroll", onScroll);
		};
	}, []);

	return (
		<>
			<header
				ref={headerRef}
				onClickCapture={handleNavigationClick}
				onFocusCapture={(event) => {
					if (event.target.matches?.(":focus-visible")) setHidden(false);
				}}
				className={`fixed top-0 left-0 right-0 z-999 flex h-16 w-[90%] items-center gap-2 m-auto bg-astra-cream text-brand-ink px-4 md:px-8 min-[1080px]:gap-0 rounded-lg border my-4
				transition-transform duration-300 ${hidden ? "-translate-y-2/1" : "translate-y-0"}`}
			>
				<div className="flex h-full min-w-0 flex-1 items-center justify-start">
					<Link
						href={homeHref}
						className="flex h-full min-w-0 flex-1 items-center justify-start"
					>
						<img
							src={LogoMark}
							alt="Ad Astra UC3M"
							width="180"
							height="50"
							className="h-10 w-auto object-contain object-left"
						/>
					</Link>
				</div>
				<div className="hidden flex-none justify-center px-4 min-[1080px]:flex">
					<DesktopNavbar links={links} activeHref={activeLink} />
				</div>
				<div className="flex flex-1 items-center justify-end gap-3">
					<div className="hidden items-center gap-3 min-[1080px]:flex">
						<JoinButton cta={cta} active={pathname === cta.href} />
						{signedIn && (
							<AccountMenu
								account={account}
								links={accountLinks}
								activeHref={activeAccountLink}
								signOutAction={signOut}
							/>
						)}
					</div>
					<div className="min-[1080px]:hidden">
						{signedIn ? (
							<MobileNavbar
								links={links}
								accountLinks={accountLinks}
								accountLabel={`Cuenta de ${account.name}`}
								cta={cta}
								activeHref={activeMobileLink}
								ctaActive={pathname === cta.href}
								header={<MobileAccountSummary account={account} />}
								footer={<SignOutButton />}
							/>
						) : (
							<VisitorMobileActions
								links={links}
								cta={cta}
								activeHref={activeLink}
								ctaActive={pathname === cta.href}
							/>
						)}
					</div>
				</div>
			</header>
		</>
	);
}

/**
 * Indica si el foco de teclado está dentro de la barra. El foco que deja un clic o un toque (por ejemplo,
 * en el botón del menú tras cerrarlo) no cuenta, para que la barra siga ocultándose al desplazarse.
 *
 * @param header Nodo del encabezado, o null antes de montarlo.
 * @returns `true` si el elemento activo está dentro y coincide con `:focus-visible`.
 */
function hasKeyboardFocusInside(header) {
	const active = document.activeElement;
	return Boolean(header && active && header.contains(active) && active.matches?.(":focus-visible"));
}

export function DesktopNavbar({ links = navItems, activeHref = null }) {
	return (
		<nav aria-label="Navegación principal">
			<ul className="flex flex-row items-center gap-1.5 xl:gap-3">
				{links.map((item) => {
					if (item.children) {
						return <NavDropdown key={item.label} item={item} />;
					}

					return (
						<li key={item.href}>
							<NavLink
								className={navLinkClassName}
								activeClassName={activeNavLinkClassName}
								href={item.href}
								active={item.href === activeHref}
							>
								{item.label}
							</NavLink>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

export function MobileNavbar({
	links = navItems,
	accountLinks = [],
	accountLabel,
	cta = getCommunityNav().cta,
	activeHref = null,
	ctaActive = false,
	header = null,
	footer = null,
}) {
	return (
		<div className="flex items-center gap-1.5 sm:gap-4">
			<JoinButton cta={cta} active={ctaActive} />
			<HamburgerMenu
				links={links}
				accountLinks={accountLinks}
				accountLabel={accountLabel}
				activeHref={activeHref}
				header={header}
				footer={footer}
			/>
		</div>
	);
}

/**
 * Acciones de visitante en móvil: con solo acceso y registro no hace falta un menú desplegable.
 */
function VisitorMobileActions({ links, cta, activeHref, ctaActive }) {
	return (
		<div className="flex items-center gap-1.5 sm:gap-4">
			<nav aria-label="Navegación principal">
				{links.map((item) => (
					<NavLink
						key={item.href}
						href={item.href}
						active={item.href === activeHref}
						className={`${navLinkClassName} min-h-11 px-1.5 text-sm sm:text-base`}
						activeClassName={activeNavLinkClassName}
					>
						{item.label}
					</NavLink>
				))}
			</nav>
			<JoinButton cta={cta} active={ctaActive} />
		</div>
	);
}

/**
 * Cabecera del menú móvil con la identidad de la sesión; el correo solo se ve al abrir el menú.
 */
function MobileAccountSummary({ account }) {
	return (
		<div className="mb-1 flex items-center gap-3 border-b border-brand-line px-3 pt-1 pb-3">
			<ProfileAvatar size="sm" decorative src={account.avatarUrl} name={account.name} />
			<div className="min-w-0">
				<p className="font-bold">{account.name}</p>
				<p className="text-sm [overflow-wrap:anywhere]">{account.email}</p>
			</div>
		</div>
	);
}

/**
 * Cierre de sesión del menú móvil, con el mismo icono animado que el menú de cuenta de escritorio.
 */
function SignOutButton() {
	return (
		<form action={signOut}>
			<AnimateIcon animateOnHover animateOnTap completeOnStop asChild>
				<button
					type="submit"
					className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-3 py-2 text-left text-brand-ink underline-offset-6 transition-colors duration-200 hover:text-brand-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
				>
					<Logout01 size={16} aria-hidden="true" focusable="false" />
					Cerrar sesión
				</button>
			</AnimateIcon>
		</form>
	);
}

function JoinButton({ cta, active = false }) {
	return (
		<Link
			href={cta.href}
			aria-current={active ? "page" : undefined}
			className={[
				navLinkClassName,
				"min-h-11 shrink-0 whitespace-nowrap rounded-lg bg-brand-ink px-3 py-2 text-sm text-brand-surface sm:px-4 sm:text-base min-[1080px]:min-h-0",
				active ? "underline decoration-brand-accent decoration-2 underline-offset-6" : "",
			].join(" ")}
		>
			{cta.label}
		</Link>
	);
}
