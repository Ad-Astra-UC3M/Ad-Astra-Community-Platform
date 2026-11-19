import assert from "node:assert/strict";
import test from "node:test";
import { db } from "./db";
import {
  createOpportunity,
  getOpportunity,
  listBookmarks,
  listOpportunities,
  removeBookmark,
  saveBookmark,
  seedOpportunities,
  updateOpportunityStatus,
} from "./opportunities";

const personA = "student-a";
const personB = "student-b";

test("semilla ofrece prácticas, investigación UC3M con portada e infoUrl y permite filtrar por tipo", () => {
  const workspaceId = "opportunities-seed";
  seedOpportunities(workspaceId);
  seedOpportunities(workspaceId);

  const all = listOpportunities(workspaceId, personA);
  assert.ok(all.length >= 3);
  assert.ok(all.every((item) => item.status === "published" && !item.bookmarked));

  const internships = listOpportunities(workspaceId, personA, "internship");
  const research = listOpportunities(workspaceId, personA, "research");
  assert.ok(internships.length >= 1);
  assert.ok(research.length >= 1);
  assert.ok(internships.every((item) => item.type === "internship"));
  assert.ok(research.every((item) => item.type === "research"));
  assert.equal(internships.length + research.length, all.length);

  const uc3mResearch = research.find((item) => item.lead && item.imageUrl && item.infoUrl);
  assert.ok(uc3mResearch);
  assert.ok(uc3mResearch.imageUrl?.startsWith("https://"));
  assert.ok(uc3mResearch.imageAlt && uc3mResearch.imageAlt.length > 0);
  assert.ok(uc3mResearch.infoUrl?.startsWith("https://"));
  assert.ok(uc3mResearch.applicationUrl || uc3mResearch.contactEmail);

  const detail = getOpportunity(workspaceId, uc3mResearch.id, personA);
  assert.deepEqual(detail, uc3mResearch);
});

test("publica ambos tipos con y sin imagen y exige invariantes de portada, HTTPS y medio de solicitud", () => {
  const workspaceId = "opportunities-invariants";

  const withoutImage = createOpportunity(workspaceId, {
    id: "custom-internship",
    type: "internship",
    title: "Prácticas de análisis estructural",
    organization: "Aether Aero (demo)",
    description: "Cálculo de elementos finitos para estructuras ligeras de lanzadores.",
    requirements: "Conocimientos de resistencia de materiales y CAD.",
    location: "Madrid",
    modality: "Híbrida",
    applicationUrl: "https://aether-aero.example/apply/structures",
    status: "published",
  });
  assert.equal(withoutImage.ok, true);
  if (withoutImage.ok) {
    assert.equal(withoutImage.opportunity.type, "internship");
    assert.equal(withoutImage.opportunity.imageUrl, null);
    assert.equal(withoutImage.opportunity.imageAlt, null);
    assert.equal(withoutImage.opportunity.status, "published");
    assert.equal(typeof withoutImage.opportunity.publishedAt, "number");
  }

  const withImageAndInfo = createOpportunity(workspaceId, {
    id: "custom-research",
    type: "research",
    title: "Beca de investigación en navegación autónoma",
    organization: "Grupo GNC · UC3M",
    description: "Estimación de actitud y navegación relativa para satélites pequeños.",
    requirements: "Control automático y programación en Python o C++.",
    location: "Campus de Leganés",
    modality: "Presencial",
    lead: "Dr. Carlos Méndez",
    contactEmail: "gnc-demo@uc3m.example",
    imageUrl: "https://gnc.uc3m.example/assets/cover.webp",
    imageAlt: "Maqueta de satélite sobre mesa óptica de calibración",
    infoUrl: "https://gnc.uc3m.example/proyectos/navegacion",
    status: "published",
  });
  assert.equal(withImageAndInfo.ok, true);
  if (withImageAndInfo.ok) {
    assert.equal(withImageAndInfo.opportunity.type, "research");
    assert.equal(withImageAndInfo.opportunity.lead, "Dr. Carlos Méndez");
    assert.equal(withImageAndInfo.opportunity.contactEmail, "gnc-demo@uc3m.example");
    assert.equal(withImageAndInfo.opportunity.applicationUrl, null);
    assert.equal(withImageAndInfo.opportunity.infoUrl, "https://gnc.uc3m.example/proyectos/navegacion");
    assert.equal(withImageAndInfo.opportunity.imageUrl, "https://gnc.uc3m.example/assets/cover.webp");
    assert.equal(withImageAndInfo.opportunity.imageAlt, "Maqueta de satélite sobre mesa óptica de calibración");
  }

  const missingAlt = createOpportunity(workspaceId, {
    type: "research",
    title: "Laboratorio de sensores",
    organization: "UC3M",
    description: "Ensayos de sensores inerciales.",
    contactEmail: "sensores@uc3m.example",
    imageUrl: "https://sensores.uc3m.example/lab.jpg",
    status: "published",
  });
  assert.deepEqual(missingAlt, { ok: false, error: "missing_image_alt" });

  const infoWithoutApplication = createOpportunity(workspaceId, {
    type: "internship",
    title: "Prácticas solo con ficha informativa",
    organization: "Empresa Demo",
    description: "Tiene enlace informativo pero carece de solicitud o correo.",
    infoUrl: "https://empresa.example/info",
    status: "published",
  });
  assert.deepEqual(infoWithoutApplication, { ok: false, error: "missing_contact" });

  const insecureApplication = createOpportunity(workspaceId, {
    type: "internship",
    title: "Enlace inseguro",
    organization: "Empresa Demo",
    description: "Rechaza esquemas no HTTPS.",
    applicationUrl: "http://empresa.example/apply",
    status: "published",
  });
  assert.deepEqual(insecureApplication, { ok: false, error: "invalid_application_url" });

  const executableInfo = createOpportunity(workspaceId, {
    type: "internship",
    title: "Info ejecutable",
    organization: "Empresa Demo",
    description: "Rechaza javascript: en infoUrl.",
    contactEmail: "jobs@empresa.example",
    infoUrl: "javascript:alert(1)",
    status: "published",
  });
  assert.deepEqual(executableInfo, { ok: false, error: "invalid_info_url" });

  const insecureImage = createOpportunity(workspaceId, {
    type: "research",
    title: "Portada HTTP",
    organization: "UC3M",
    description: "Rechaza portada no HTTPS.",
    contactEmail: "lab@uc3m.example",
    imageUrl: "http://lab.uc3m.example/cover.png",
    imageAlt: "Texto alternativo",
    status: "published",
  });
  assert.deepEqual(insecureImage, { ok: false, error: "invalid_image_url" });

  const invalidEmail = createOpportunity(workspaceId, {
    type: "research",
    title: "Correo con prefijo",
    organization: "UC3M",
    description: "Rechaza correos mal formados.",
    contactEmail: "mailto:lab@uc3m.example",
    status: "published",
  });
  assert.deepEqual(invalidEmail, { ok: false, error: "invalid_contact_email" });

  const missingTitle = createOpportunity(workspaceId, {
    type: "internship",
    title: "   ",
    organization: "Empresa Demo",
    description: "Descripción válida.",
    applicationUrl: "https://empresa.example/apply",
    status: "published",
  });
  assert.deepEqual(missingTitle, { ok: false, error: "missing_title" });

  const missingDescription = createOpportunity(workspaceId, {
    type: "internship",
    title: "Título válido",
    organization: "Empresa Demo",
    description: "   ",
    applicationUrl: "https://empresa.example/apply",
    status: "published",
  });
  assert.deepEqual(missingDescription, { ok: false, error: "missing_description" });

  const incompleteDraft = createOpportunity(workspaceId, {
    id: "draft-without-contact",
    type: "internship",
    title: "Borrador sin contacto",
    organization: "Empresa Demo",
    description: "Pendiente de definir enlace externo.",
    infoUrl: "https://empresa.example/mas-info",
    status: "draft",
  });
  assert.equal(incompleteDraft.ok, true);
  assert.equal(getOpportunity(workspaceId, "draft-without-contact", personA), undefined);
  assert.deepEqual(
    updateOpportunityStatus(workspaceId, "draft-without-contact", "published"),
    { ok: false, error: "missing_contact" },
  );

  const validDraft = createOpportunity(workspaceId, {
    id: "draft-ready",
    type: "research",
    title: "Borrador listo para publicar",
    organization: "UC3M",
    description: "Estudio de materiales compuestos.",
    contactEmail: "materiales@uc3m.example",
    status: "draft",
  });
  assert.equal(validDraft.ok, true);
  assert.equal(
    listOpportunities(workspaceId, personA).some((item) => item.id === "draft-ready"),
    false,
  );

  const published = updateOpportunityStatus(workspaceId, "draft-ready", "published");
  assert.equal(published.ok, true);
  if (published.ok) {
    assert.equal(published.opportunity.status, "published");
    assert.equal(typeof published.opportunity.publishedAt, "number");
  }
  assert.ok(getOpportunity(workspaceId, "draft-ready", personA));
});

test("guarda y retira marcadores de forma única, idempotente y aislada por persona y espacio", () => {
  const workspaceId = "opportunities-bookmarks";
  const [first] = listOpportunities(workspaceId, personA);
  assert.ok(first);

  assert.equal(saveBookmark(workspaceId, personA, first.id), "saved");
  assert.equal(saveBookmark(workspaceId, personA, first.id), "saved");

  const rowCount = db.prepare(`
    SELECT COUNT(*) AS total FROM demo_opportunity_bookmarks
    WHERE workspace_id = ? AND opportunity_id = ? AND person_id = ?
  `).get(workspaceId, first.id, personA) as { total: number };
  assert.equal(rowCount.total, 1);

  assert.equal(getOpportunity(workspaceId, first.id, personA)?.bookmarked, true);
  assert.equal(getOpportunity(workspaceId, first.id, personB)?.bookmarked, false);
  assert.equal(listBookmarks(workspaceId, personA).length, 1);
  assert.deepEqual(listBookmarks(workspaceId, personB), []);
  assert.deepEqual(listBookmarks("other-workspace", personA), []);

  assert.equal(saveBookmark(workspaceId, personA, "missing-id"), "missing");

  assert.equal(removeBookmark(workspaceId, personA, first.id), "removed");
  assert.equal(removeBookmark(workspaceId, personA, first.id), "removed");
  assert.deepEqual(listBookmarks(workspaceId, personA), []);
  assert.equal(getOpportunity(workspaceId, first.id, personA)?.bookmarked, false);
});

test("al archivar una oportunidad guardada, el marcador queda cerrado con datos mínimos y sin enlace de solicitud", () => {
  const workspaceId = "opportunities-archive";
  const catalog = listOpportunities(workspaceId, personA);
  const target = catalog[catalog.length - 1];
  assert.ok(target);

  assert.equal(saveBookmark(workspaceId, personA, target.id), "saved");
  const archived = updateOpportunityStatus(workspaceId, target.id, "archived");
  assert.equal(archived.ok, true);

  assert.equal(
    listOpportunities(workspaceId, personA).some((item) => item.id === target.id),
    false,
  );
  assert.equal(getOpportunity(workspaceId, target.id, personA), undefined);
  assert.equal(saveBookmark(workspaceId, personB, target.id), "missing");

  const bookmarks = listBookmarks(workspaceId, personA);
  assert.equal(bookmarks.length, 1);
  assert.deepEqual(bookmarks[0], {
    id: target.id,
    type: target.type,
    title: target.title,
    organization: target.organization,
    status: "archived",
  });
  assert.equal("applicationUrl" in bookmarks[0], false);
  assert.equal("contactEmail" in bookmarks[0], false);
  assert.equal("infoUrl" in bookmarks[0], false);

  assert.equal(removeBookmark(workspaceId, personA, target.id), "removed");
  assert.deepEqual(listBookmarks(workspaceId, personA), []);
});
