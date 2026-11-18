import { projectLinks, sectionLinks, socialLinks } from "./siteLinks";

const navItems = [
	{ label: "Inicio", to: sectionLinks.home },
	{
		label: "Proyectos",
		children: [
			{ 
				label: "SIGMA", 
				to: projectLinks["sigma"] 
			},
			{
				label: "Ascend A4",
				to: projectLinks["ascend-a4"],
			},
			{
				label: "Jet Engine",
				to: projectLinks["jet-engine"],
			},
			{
				label: "Todos los proyectos",
				to: sectionLinks.projects,
				hasDividerBefore: true,
			},
		],
	},
	{ label: "Sponsors", to: sectionLinks.sponsors },
	{ label: "Equipo", to: sectionLinks.team },
	{ label: "Redes sociales", children: socialLinks },
];

export default navItems;
