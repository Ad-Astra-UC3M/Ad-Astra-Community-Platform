import Link from "next/link";

import HamburgerMenu from "../ui/HamburgerMenu";
import navItems, { getCommunityNav } from "../../data/navItems";
import LogoMark from "../../assets/navbar-logo.svg";
import NavDropdown from "./NavDropdown";
import { useEffect, useState, useRef } from "react";

const navLinkClassName =
	"inline-flex items-center whitespace-nowrap px-3 py-2 font-normal underline-offset-6 transition duration-200 hover:text-brand-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent";

export default function Navbar({ role }) {
	const { homeHref, links, cta } = getCommunityNav(role);
	const [hidden, setHidden] = useState(false);
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

			if (preventHide.current) {
				lastScrollY.current = currentY;
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
		<header
			onClickCapture={handleNavigationClick}
			className={`fixed top-0 left-0 right-0 z-999 flex h-16 w-[90%] items-center gap-2 m-auto bg-astra-cream text-brand-ink px-4 md:px-8 min-[890px]:gap-0 rounded-lg border my-4
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
			<div className="hidden flex-1 justify-center min-[890px]:flex">
				<DesktopNavbar links={links} />
			</div>
			<div className="flex flex-1 justify-end">
				<div className="hidden min-[890px]:block">
					<JoinButton cta={cta} />
				</div>
				<div className="min-[890px]:hidden">
					<MobileNavbar links={links} cta={cta} />
				</div>
			</div>
		</header>
	);
}

export function DesktopNavbar({ links = navItems }) {
	return (
		<nav aria-label="Navegación principal">
			<ul className="flex flex-row items-center gap-2 xl:gap-4">
				{links.map((item) => {
					if (item.children) {
						return <NavDropdown key={item.label} item={item} />;
					}

					return (
						<li key={item.href}>
							<Link className={navLinkClassName} href={item.href}>
								{item.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

export function MobileNavbar({ links = navItems, cta = getCommunityNav().cta }) {
	return (
		<div className="flex items-center gap-1.5 sm:gap-4">
			<JoinButton cta={cta} />
			<HamburgerMenu links={links} />
		</div>
	);
}

function JoinButton({ cta }) {
	return (
		<Link
			href={cta.href}
			className={[
				navLinkClassName,
				"min-h-11 shrink-0 whitespace-nowrap rounded-lg bg-brand-ink px-3 py-2 text-sm text-brand-surface sm:px-4 sm:text-base min-[890px]:min-h-0",
			].join(" ")}
		>
			{cta.label}
		</Link>
	);
}
