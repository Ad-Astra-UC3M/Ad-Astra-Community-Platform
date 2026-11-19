const institutionalOrigin = "https://www.adastrauc3m.es";

export const sectionLinks = {
	home: `${institutionalOrigin}/#home`,
	projects: `${institutionalOrigin}/#projects`,
	sponsors: `${institutionalOrigin}/#sponsors`,
	about: `${institutionalOrigin}/#about`,
	team: `${institutionalOrigin}/team`,
	join: `${institutionalOrigin}/join`,
};

export const projectLinks = {
	sigma: `${institutionalOrigin}/?project=sigma#projects`,
	"ascend-a4": `${institutionalOrigin}/?project=ascend-a4#projects`,
	"jet-engine": `${institutionalOrigin}/?project=jet-engine#projects`,
};

export const socialLinks = [
	{
		platform: "linkedin",
		label: "LinkedIn",
		href: "https://www.linkedin.com/company/ad-astra-uc3m/",
	},
	{
		platform: "instagram",
		label: "Instagram",
		href: "https://www.instagram.com/adastrauc3m/",
	},
	{
		platform: "tiktok",
		label: "TikTok",
		href: "https://www.tiktok.com/@adastrauc3m",
	},
];

const SPONSOR_EMAIL = "partnerships@adastrauc3m.es";

export function getSponsorEmailLink(projectName) {
	const subject = projectName
		? `Colaboración como sponsor · ${projectName}`
		: "Colaboración como sponsor · Ad Astra UC3M";
	const body = projectName
		? `Hola, me gustaría conocer las opciones para colaborar con el proyecto ${projectName}.`
		: "Hola, me gustaría conocer las opciones para colaborar como sponsor de Ad Astra UC3M.";

	return `mailto:${SPONSOR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const joinTeams = [
  { key: "it", name: "IT", formId: "YjPykJ", description: "Programa, aprende y crea herramientas y experiencias web con nosotros." },
  { key: "eventos", name: "Eventos", formId: "VpjxAE", description: "Ayuda a organizar actividades y encuentros para la comunidad de Ad Astra." },
];

