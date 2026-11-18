"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const startLinks = [
  { href: "/home", label: "Inicio" },
  { href: "/activities", label: "Actividades" },
];

const studentLinks = [
  { href: "/my-activities", label: "Mis actividades" },
  { href: "/qr-card", label: "Tarjeta QR" },
];

const organizerLinks = [
  { href: "/admin", label: "Gestión" },
];

const publicLinks = [
  { href: "https://adastrauc3m.es/#projects", label: "Proyectos" },
  { href: "https://adastrauc3m.es/#sponsors", label: "Sponsors" },
  { href: "https://adastrauc3m.es/team", label: "Equipo" },
];

export function CommunityNavigation({ role }: { role?: "student" | "organizer" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = role ? [...startLinks, ...(role === "organizer" ? organizerLinks : studentLinks)] : publicLinks;

  return (
    <>
      <button
        className="menu-toggle"
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-controls="community-navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <HugeiconsIcon icon={open ? Cancel01Icon : Menu01Icon} size={22} aria-hidden="true" />
      </button>
      <nav
        aria-label="Navegación de la comunidad"
        id="community-navigation"
        data-open={open}
        className="community-nav"
      >
        <ul>
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
