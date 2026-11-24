import {
	Disclosure,
	DisclosureButton,
	DisclosurePanel,
	Popover,
	PopoverButton,
	PopoverPanel,
} from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import SocialIcon from "./SocialIcon";

const navLinkClassName = "flex items-center gap-2 rounded-sm px-3 py-2 font-normal underline-offset-6 transition-colors duration-200 hover:text-brand-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent";

function MobileNavLink({ item, onNavigate, nested = false, active = false }) {
	if (item.external || item.platform) {
		return (
			<a
				href={item.href}
				onClick={onNavigate}
				className={[navLinkClassName, nested ? "pl-6" : ""].join(" ")}
			>
				<SocialIcon className="size-4 shrink-0" platform={item.platform} />
				<span>{item.label}</span>
			</a>
		);
	}

	return (
		<Link
			href={item.href}
			onClick={onNavigate}
			aria-current={active ? "page" : undefined}
			className={[
				navLinkClassName,
				"min-h-11",
				nested ? "pl-6" : "",
				active ? "font-bold text-brand-primary underline decoration-2" : "",
			].join(" ")}
		>
			{item.label}
		</Link>
	);
}

function NavAccordion({ item, onNavigate }) {
	return (
		<Disclosure as="li">
			<DisclosureButton className="group flex w-full items-center justify-between rounded-sm px-3 py-2 text-left font-normal underline-offset-6 transition-colors duration-200 hover:text-brand-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent data-open:text-brand-accent data-open:underline">
				{item.label}
				<ChevronDown
					aria-hidden="true"
					className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-open:rotate-180 motion-reduce:transition-none"
				/>
			</DisclosureButton>

			<DisclosurePanel
				transition
				className="origin-top transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-closed:-translate-y-1 data-closed:opacity-0 data-leave:duration-150 motion-reduce:transform-none motion-reduce:transition-opacity"
			>
				<ul>
					{item.children.map((child) => (
						<Fragment key={child.href}>
							{child.hasDividerBefore && (
								<li
									role="separator"
									className="mx-3 my-2 border-t border-brand-soft"
								/>
							)}

							<li>
								<MobileNavLink
									item={child}
									onNavigate={onNavigate}
									nested
								/>
							</li>
						</Fragment>
					))}
				</ul>
			</DisclosurePanel>
		</Disclosure>
	);
}

/**
 * Menú móvil desplegable. Comunidad le pasa la ruta activa y, con sesión, la identidad (`header`), los enlaces
 * de cuenta (`accountLinks`, agrupados aparte bajo `accountLabel`) y el cierre de sesión (`footer`); la landing
 * original lo usa solo con `links`.
 */
export default function HamburgerMenu({
	links,
	activeHref = null,
	header = null,
	footer = null,
	accountLinks = [],
	accountLabel = "Cuenta",
}) {
	const hasAccountGroup = accountLinks.length > 0 || footer;
	return (
		<Popover as="div">
			{({ close }) => (
				<>
					<PopoverButton
						type="button"
						className="group relative block size-11 text-brand-ink transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent data-open:text-brand-accent active:scale-[0.97] motion-reduce:transition-none"
					>
						{/* Nota de accesibilidad: estos textos ocultos dan nombre al botón
						    según su estado; Headless UI ya gestiona aria-expanded y aria-controls. */}
						<span className="sr-only group-data-open:hidden">Abrir menú</span>
						<span className="sr-only hidden group-data-open:inline">
							Cerrar menú
						</span>

						<span
							aria-hidden="true"
							className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-2 rounded-full bg-current transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-open:-translate-y-1/2 group-data-open:rotate-45 motion-reduce:transition-none"
						/>
						<span
							aria-hidden="true"
							className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-opacity duration-150 group-data-open:opacity-0 motion-reduce:transition-none"
						/>
						<span
							aria-hidden="true"
							className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 translate-y-1.5 rounded-full bg-current transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-open:-translate-y-1/2 group-data-open:-rotate-45 motion-reduce:transition-none"
						/>
					</PopoverButton>

					<PopoverPanel
						as="nav"
						aria-label="Navegación móvil"
						transition
						className="absolute -inset-x-px top-full z-50 mt-2 max-h-[calc(100vh-6rem)] w-auto origin-top-right overflow-y-auto rounded-lg border border-brand-line bg-brand-surface p-2 text-brand-ink shadow-lg focus:outline-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-closed:translate-y-1 data-closed:scale-95 data-closed:opacity-0 data-leave:duration-150 motion-reduce:transform-none motion-reduce:transition-opacity"
					>
						{header}
						<ul>
							{links.map((item) =>
								item.children ? (
									<NavAccordion
										key={item.label}
										item={item}
										onNavigate={close}
									/>
								) : (
									<li key={item.href}>
										<MobileNavLink
											item={item}
											onNavigate={close}
											active={item.href === activeHref}
										/>
									</li>
								),
							)}
						</ul>
						{/* Como en el menú de cuenta de escritorio, la cuenta forma un grupo propio y separado. */}
						{hasAccountGroup && (
							<div role="group" aria-label={accountLabel} className="mt-1 border-t border-brand-line pt-1">
								<ul>
									{accountLinks.map((item) => (
										<li key={item.href}>
											<MobileNavLink
												item={item}
												onNavigate={close}
												active={item.href === activeHref}
											/>
										</li>
									))}
								</ul>
								{footer}
							</div>
						)}
					</PopoverPanel>
				</>
			)}
		</Popover>
	);
}
