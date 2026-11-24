"use client";

/**
 * @file Menú de cuenta de la barra institucional en escritorio. Sustituye a la antigua franja de sesión:
 * reúne perfil, privacidad, panel administrativo cuando procede y cierre de sesión bajo el avatar.
 */

import { AnimateIcon } from "@animate-ui/react/icons";
import {
	Menu,
	MenuButton,
	MenuHeading,
	MenuItem,
	MenuItems,
	MenuSection,
	MenuSeparator,
} from "@headlessui/react";
import { useRef } from "react";
import { ArrowDown01 } from "../../../components/animate-ui/icons/hugeicons/arrow-down-01";
import { Logout01 } from "../../../components/animate-ui/icons/hugeicons/logout-01";
import { ProfileAvatar } from "../../../components/profile-avatar";
import { NavLink } from "./NavLink";

// Headless UI deja el foco en el contenedor y marca la opción activa con `data-focus`: el anillo, el
// subrayado y el color hacen visible esa opción, no solo el fondo claro.
const itemClassName =
	"flex min-h-11 w-full items-center rounded-sm px-3 py-2 text-left no-underline data-[focus]:bg-brand-panel data-[focus]:text-brand-primary data-[focus]:underline data-[focus]:ring-2 data-[focus]:ring-inset data-[focus]:ring-brand-primary";

/**
 * Renderiza el botón con el avatar y, al abrirse, el nombre, el correo, los enlaces de cuenta y el botón de
 * cierre de sesión. Headless UI gestiona foco, teclado y Escape.
 *
 * @param props.account Nombre, correo y URL privada del avatar que resuelve RootLayout.
 * @param props.links Enlaces de `getCommunityNav().accountLinks`.
 * @param props.activeHref Destino activo dentro de `links`, o null.
 * @param props.signOutAction Server Action que cierra la sesión y vuelve a la portada.
 * @returns Menú desplegable de la cuenta.
 */
export function AccountMenu({ account, links, activeHref, signOutAction }) {
	const signOutForm = useRef(null);
	return (
		<Menu as="div" className="relative">
			<AnimateIcon animateOnHover completeOnStop asChild>
				<MenuButton
					aria-label={`Menú de cuenta de ${account.name}`}
					className="flex min-h-11 items-center gap-1 rounded-full py-0.5 pr-1 pl-0.5 text-brand-ink transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary data-[open]:text-brand-primary"
				>
					<ProfileAvatar size="sm" decorative src={account.avatarUrl} name={account.name} />
					<ArrowDown01 size={16} aria-hidden="true" focusable="false" />
				</MenuButton>
			</AnimateIcon>
			<MenuItems
				anchor="bottom end"
				className="z-[1000] w-72 rounded-lg border border-brand-line bg-brand-surface p-2 text-brand-ink shadow-lg [--anchor-gap:0.75rem] focus:outline-none"
			>
				<MenuSection>
					<MenuHeading className="mb-1 border-b border-brand-line px-3 pt-1 pb-2">
						<span className="block font-bold">{account.name}</span>
						<span className="block text-sm [overflow-wrap:anywhere]">{account.email}</span>
					</MenuHeading>
					{links.map(({ label, href }) => (
						<MenuItem key={href}>
							<NavLink
								href={href}
								active={href === activeHref}
								className={itemClassName}
								activeClassName="font-bold text-brand-primary"
								inactiveClassName="text-brand-ink"
							>
								{label}
							</NavLink>
						</MenuItem>
					))}
				</MenuSection>
				<MenuSeparator className="my-1 h-px bg-brand-line" />
				<MenuItem>
					{({ focus }) => (
						<button
							type="button"
							onClick={() => signOutForm.current?.requestSubmit()}
							className={`${itemClassName} cursor-pointer gap-2 border-0 bg-transparent text-brand-ink`}
						>
							{/* La opción se anima al quedar activa, con el puntero o con las flechas. */}
							<Logout01 size={16} animate={focus} completeOnStop aria-hidden="true" focusable="false" />
							Cerrar sesión
						</button>
					)}
				</MenuItem>
			</MenuItems>
			{/* El formulario vive fuera de MenuItems: Headless UI desmonta el menú al elegir una opción y
			    un formulario desmontado no llega a enviarse. */}
			<form ref={signOutForm} action={signOutAction} hidden />
		</Menu>
	);
}
