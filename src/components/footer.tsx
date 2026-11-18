import Image from "next/image";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const site = "https://adastrauc3m.es";
const sections = [
  { title: "Proyectos", links: [
    ["SIGMA", site + "/?project=sigma#projects"],
    ["Ascend A4", site + "/?project=ascend-a4#projects"],
    ["Jet Engine", site + "/?project=jet-engine#projects"],
  ] },
  { title: "Asociación", links: [
    ["Equipo", site + "/team"], ["Únete a IT / Eventos", site + "/join"],
  ] },
  { title: "Más", links: [
    ["Sponsors", site + "/#sponsors"],
    ["LinkedIn", "https://www.linkedin.com/company/ad-astra-uc3m/"],
    ["Instagram", "https://www.instagram.com/adastrauc3m/"],
    ["TikTok", "https://www.tiktok.com/@adastrauc3m"],
  ] },
];

export function Footer() {
  return <footer className="institutional-footer">
    <div className="frame footer-main">
      <a href={site} aria-label="Ad Astra UC3M, web institucional">
        <Image src="/brand/ad-astra.svg" alt="Ad Astra UC3M" width={180} height={62} />
      </a>
      <p>Ingeniería para llegar a las estrellas</p>
      <nav aria-label="Pie de página">{sections.map(section => <section key={section.title}>
        <h2>{section.title}</h2>
        <ul>{section.links.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
      </section>)}</nav>
    </div>
    <div className="footer-base"><div className="frame">
      <Image src="/brand/reclining-doodle.png" alt="" width={144} height={76} />
      <span>Hecho con <HugeiconsIcon icon={FavouriteIcon} size={16} role="img" aria-label="amor" /> por el equipo de IT de Ad Astra</span>
      <span>© 2026 Ad Astra UC3M</span>
    </div></div>
  </footer>;
}
