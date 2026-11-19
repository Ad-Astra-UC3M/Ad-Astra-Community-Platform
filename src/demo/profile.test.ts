import assert from "node:assert/strict";
import test from "node:test";
import { db } from "./db";
import {
  DISSEMINATION_POLICY_VERSION,
  DISSEMINATION_PURPOSE,
  getBasicProfile,
  getDisseminationStatus,
  getMyDeletionRequest,
  getTalentProfile,
  parseTagList,
  requestAccountDeletion,
  saveTalentProfile,
  setDisseminationDecision,
  updateBasicProfile,
} from "./profile";
import { SessionStore, readSignUp } from "./session-store";

const store = new SessionStore(db);

function createVerifiedStudent(workspaceId: string, email: string, firstName = "Lucía", lastName = "Ejemplo", now = Date.now()) {
  const form = new FormData();
  form.set("firstName", firstName);
  form.set("lastName", lastName);
  form.set("email", email);
  form.set("degree", "Ingeniería Aeroespacial");
  form.set("course", "2.º");
  form.set("password", "ComunidadDemo2026!");
  form.set("privacy", "accepted");
  const parsed = readSignUp(form);
  assert.ok(parsed.ok);

  const token = `verify-${workspaceId}-${email}`;
  assert.equal(store.createAccount(workspaceId, parsed.input, token, now), true);
  const user = store.verifyAccount(workspaceId, token, now);
  assert.ok(user);
  return user;
}

test("CA-02: lee y actualiza el perfil básico sin alterar correo, identidad ni historial, y sin cambios parciales", () => {
  const workspaceId = "profile-basic";
  const createdAt = 1_760_000_000_000;
  const student = createVerifiedStudent(workspaceId, "lucia.perfil@alumnos.uc3m.es", "Lucía", "Ejemplo", createdAt);

  const initial = getBasicProfile(workspaceId, student.id);
  assert.deepEqual(initial, {
    id: student.id,
    firstName: "Lucía",
    lastName: "Ejemplo",
    email: "lucia.perfil@alumnos.uc3m.es",
    degree: "Ingeniería Aeroespacial",
    course: "2.º",
    privacyVersion: "demo-1",
    privacyAcceptedAt: createdAt,
  });

  // Aislamiento de espacio de trabajo
  assert.equal(getBasicProfile("other-workspace", student.id), null);

  // Rechazo de modificación del correo (email inmutable)
  assert.deepEqual(
    updateBasicProfile(workspaceId, student.id, {
      firstName: "Lucía Nueva",
      lastName: "Ejemplo",
      degree: "Ingeniería Aeroespacial",
      course: "3.º",
      email: "otro@alumnos.uc3m.es",
    }),
    { ok: false, error: "email_immutable" },
  );

  // Rechazo de modificación de rol o id
  assert.deepEqual(
    updateBasicProfile(workspaceId, student.id, {
      firstName: "Lucía Nueva",
      lastName: "Ejemplo",
      degree: "Ingeniería Aeroespacial",
      course: "3.º",
      role: "organizer",
    }),
    { ok: false, error: "identity_immutable" },
  );
  assert.deepEqual(
    updateBasicProfile(workspaceId, student.id, {
      firstName: "Lucía Nueva",
      lastName: "Ejemplo",
      degree: "Ingeniería Aeroespacial",
      course: "3.º",
      id: "otro-id",
    }),
    { ok: false, error: "identity_immutable" },
  );

  // Rechazo atómico sin actualizaciones parciales cuando falla un campo obligatorio o de longitud
  assert.deepEqual(
    updateBasicProfile(workspaceId, student.id, {
      firstName: "Nombre Que No Debe Guardarse",
      lastName: "Ejemplo",
      degree: "Ingeniería Aeroespacial",
      course: "   ",
    }),
    { ok: false, error: "fields" },
  );
  assert.deepEqual(
    updateBasicProfile(workspaceId, student.id, {
      firstName: "Nombre Que No Debe Guardarse",
      lastName: "Ejemplo",
      degree: "D".repeat(121),
      course: "3.º",
    }),
    { ok: false, error: "fields" },
  );
  assert.deepEqual(getBasicProfile(workspaceId, student.id), initial);

  // Actualización válida (incluso reenviando el mismo correo vigente sin cambiarlo)
  const updated = updateBasicProfile(workspaceId, student.id, {
    firstName: "Lucía",
    lastName: "Martínez",
    degree: "Doble Grado en Ingeniería Aeroespacial",
    course: "3.º",
    email: "LUCIA.PERFIL@ALUMNOS.UC3M.ES",
  });
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.deepEqual(updated.profile, {
      id: student.id,
      firstName: "Lucía",
      lastName: "Martínez",
      email: "lucia.perfil@alumnos.uc3m.es",
      degree: "Doble Grado en Ingeniería Aeroespacial",
      course: "3.º",
      privacyVersion: "demo-1",
      privacyAcceptedAt: createdAt,
    });
  }

  // Cuenta demo de fixture sin correo real muestra correo sintético de solo lectura y rechaza cambiarlo
  const fixtureWorkspace = "profile-fixture";
  const fixtureStudent = store.demoUser(fixtureWorkspace, "student");
  const fixtureProfile = getBasicProfile(fixtureWorkspace, fixtureStudent.id);
  assert.ok(fixtureProfile);
  assert.equal(fixtureProfile.email, "estudiante.demo@alumnos.uc3m.es");
  assert.deepEqual(
    updateBasicProfile(fixtureWorkspace, fixtureStudent.id, {
      firstName: "Ana",
      lastName: "Demo",
      degree: "Ingeniería Informática",
      course: "4.º",
      email: "cambiado@alumnos.uc3m.es",
    }),
    { ok: false, error: "email_immutable" },
  );
  const fixtureUpdated = updateBasicProfile(fixtureWorkspace, fixtureStudent.id, {
    firstName: "Ana",
    lastName: "Demo",
    degree: "Ingeniería Informática",
    course: "4.º",
  });
  assert.equal(fixtureUpdated.ok, true);
  assert.equal(getBasicProfile(fixtureWorkspace, fixtureStudent.id)?.email, "estudiante.demo@alumnos.uc3m.es");
});

test("CA-04: gestiona perfil de talento vacío, completo, edición, retirada de enlaces, rechazo de esquemas peligrosos y aislamiento", () => {
  const workspaceId = "profile-talent";
  const owner = createVerifiedStudent(workspaceId, "talento@alumnos.uc3m.es", "Clara", "Ramos");
  const peer = createVerifiedStudent(workspaceId, "companero@alumnos.uc3m.es", "Diego", "Soler");
  const organizer = store.demoUser(workspaceId, "organizer");

  // Perfil inicialmente vacío para la persona titular
  const empty = getTalentProfile(workspaceId, owner.id, owner.id);
  assert.deepEqual(empty, {
    accountId: owner.id,
    university: "",
    graduationYear: null,
    headline: "",
    experiencesSummary: "",
    featuredProject: "",
    skills: [],
    tools: [],
    interests: [],
    sectors: [],
    languages: [],
    links: [],
    updatedAt: null,
  });

  // Guardado completo con enlaces http/https válidos
  const saved = saveTalentProfile(workspaceId, owner.id, {
    university: "Universidad Carlos III de Madrid",
    graduationYear: 2027,
    headline: "Estudiante de propulsión y aviónica",
    experiencesSummary: "Prácticas en laboratorio de estructuras aeroespaciales.",
    featuredProject: "Banco de ensayos de telemetría para cohete experimental",
    skills: parseTagList("C++, Python, CAD, c++"),
    tools: ["MATLAB", "KiCad", "Git"],
    interests: ["Satélites pequeños", "Control de vuelo"],
    sectors: ["Aeroespacial", "Robótica"],
    languages: ["Español (nativo)", "Inglés (C1)"],
    links: [
      { kind: "cv", label: "CV actualizado", url: "https://example.org/clara-cv.pdf" },
      { kind: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/clara-demo" },
      { kind: "github", label: "GitHub", url: "https://github.com/clara-demo" },
      { kind: "portfolio", label: "Portfolio", url: "http://clara-demo.example.com/proyectos" },
    ],
  });
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.profile.university, "Universidad Carlos III de Madrid");
    assert.equal(saved.profile.graduationYear, 2027);
    assert.deepEqual(saved.profile.skills, ["C++", "Python", "CAD"]);
    assert.equal(saved.profile.links.length, 4);
    assert.equal(typeof saved.profile.updatedAt, "number");
  }

  // Aislamiento: ni otro estudiante ni un organizador sin capacidad explícita pueden leer el perfil ajeno
  assert.equal(getTalentProfile(workspaceId, peer.id, owner.id), null);
  assert.equal(getTalentProfile(workspaceId, organizer.id, owner.id), null);
  assert.equal(getTalentProfile("other-workspace", owner.id, owner.id), null);

  // Rechaza esquemas ejecutables y no seguros conservando los datos válidos previos
  for (const badUrl of [
    "javascript:alert(1)",
    "JAVASCRIPT:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "mailto:test@uc3m.es",
    "ftp://files.example.org/cv.pdf",
    "no-es-una-url",
  ]) {
    assert.deepEqual(
      saveTalentProfile(workspaceId, owner.id, {
        university: "No debe guardarse",
        links: [{ kind: "other", label: "Malo", url: badUrl }],
      }),
      { ok: false, error: "invalid_url" },
      `Debe rechazar la URL ${badUrl}`,
    );
  }

  // Rechaza tipo de enlace inválido y año inválido sin alterar lo guardado
  assert.deepEqual(
    saveTalentProfile(workspaceId, owner.id, {
      links: [{ kind: "unknown" as never, label: "Otro", url: "https://example.org" }],
    }),
    { ok: false, error: "invalid_link_kind" },
  );
  assert.deepEqual(
    saveTalentProfile(workspaceId, owner.id, { graduationYear: 1800 }),
    { ok: false, error: "invalid_year" },
  );
  assert.deepEqual(
    saveTalentProfile(workspaceId, owner.id, { graduationYear: "dos-mil-veinte" }),
    { ok: false, error: "invalid_year" },
  );

  const afterRejected = getTalentProfile(workspaceId, owner.id, owner.id);
  assert.equal(afterRejected?.university, "Universidad Carlos III de Madrid");
  assert.equal(afterRejected?.links.length, 4);

  // Permite vaciar campos opcionales y retirar enlaces
  const cleared = saveTalentProfile(workspaceId, owner.id, {
    university: "",
    graduationYear: null,
    headline: "",
    experiencesSummary: "",
    featuredProject: "",
    skills: [],
    tools: [],
    interests: [],
    sectors: [],
    languages: [],
    links: [],
  });
  assert.equal(cleared.ok, true);
  const afterClear = getTalentProfile(workspaceId, owner.id, owner.id);
  assert.equal(afterClear?.university, "");
  assert.equal(afterClear?.graduationYear, null);
  assert.deepEqual(afterClear?.skills, []);
  assert.deepEqual(afterClear?.links, []);
});

test("CA-04: decisión de difusión separada por defecto no concedida, historial de versiones y sin borrar el perfil de talento", () => {
  const workspaceId = "profile-dissemination";
  const student = createVerifiedStudent(workspaceId, "difusion@alumnos.uc3m.es", "Mateo", "Vega");

  const savedTalent = saveTalentProfile(workspaceId, student.id, {
    university: "UC3M",
    headline: "Aviónica embebida",
    skills: ["Rust", "RTOS"],
    links: [{ kind: "github", label: "GitHub", url: "https://github.com/mateo-demo" }],
  });
  assert.equal(savedTalent.ok, true);

  // Por defecto no concedida
  const initial = getDisseminationStatus(workspaceId, student.id);
  assert.deepEqual(initial, {
    purpose: DISSEMINATION_PURPOSE,
    policyVersion: DISSEMINATION_POLICY_VERSION,
    granted: false,
    decidedAt: null,
    history: [],
  });
  assert.equal(initial.purpose, "internal_and_future_talent_sharing");
  assert.equal(initial.policyVersion, "talent-diffusion-v1");

  // Concesión y retirada registran historial con finalidad, versión y fecha
  const t1 = 1_760_100_000_000;
  const granted = setDisseminationDecision(workspaceId, student.id, true, t1);
  assert.ok(granted);
  assert.equal(granted.granted, true);
  assert.equal(granted.decidedAt, t1);
  assert.equal(granted.history.length, 1);

  const t2 = 1_760_200_000_000;
  const revoked = setDisseminationDecision(workspaceId, student.id, false, t2);
  assert.ok(revoked);
  assert.equal(revoked.granted, false);
  assert.equal(revoked.decidedAt, t2);
  assert.equal(revoked.history.length, 2);
  assert.equal(revoked.history[0]?.granted, false);
  assert.equal(revoked.history[0]?.decidedAt, t2);
  assert.equal(revoked.history[0]?.policyVersion, "talent-diffusion-v1");
  assert.equal(revoked.history[0]?.purpose, "internal_and_future_talent_sharing");
  assert.equal(revoked.history[1]?.granted, true);
  assert.equal(revoked.history[1]?.decidedAt, t1);

  // Retirar la difusión no borra el perfil de talento ni bloquea el perfil básico
  const talentAfterRevoke = getTalentProfile(workspaceId, student.id, student.id);
  assert.equal(talentAfterRevoke?.headline, "Aviónica embebida");
  assert.equal(talentAfterRevoke?.links.length, 1);
  assert.equal(getBasicProfile(workspaceId, student.id)?.email, "difusion@alumnos.uc3m.es");
});

test("CA-11: solicitud de supresión idempotente para solicitudes abiertas y bloqueada frente a lectura ajena", () => {
  const workspaceId = "profile-deletion";
  const owner = createVerifiedStudent(workspaceId, "supresion@alumnos.uc3m.es", "Elena", "Cano");
  const other = createVerifiedStudent(workspaceId, "ajeno@alumnos.uc3m.es", "Hugo", "Gil");

  assert.equal(getMyDeletionRequest(workspaceId, owner.id), null);

  const t1 = 1_760_300_000_000;
  const first = requestAccountDeletion(workspaceId, owner.id, "Ya terminé la titulación.", t1);
  assert.equal(first.ok, true);
  assert.ok(first.ok);
  assert.equal(first.created, true);
  assert.equal(first.request.status, "pending");
  assert.equal(first.request.reason, "Ya terminé la titulación.");
  assert.equal(first.request.createdAt, t1);
  assert.equal(first.request.resolvedAt, null);

  // No ejecuta un borrado automático de la cuenta
  assert.equal(getBasicProfile(workspaceId, owner.id)?.email, "supresion@alumnos.uc3m.es");

  // Reenviar con solicitud abierta (pending) devuelve la existente sin duplicar
  const duplicatePending = requestAccountDeletion(workspaceId, owner.id, "Segundo intento", t1 + 10_000);
  assert.equal(duplicatePending.ok, true);
  assert.ok(duplicatePending.ok);
  assert.equal(duplicatePending.created, false);
  assert.deepEqual(duplicatePending.request, first.request);

  // También es idempotente si pasa a in_review
  db.prepare(`
    UPDATE demo_deletion_requests SET status = 'in_review'
    WHERE workspace_id = ? AND id = ?
  `).run(workspaceId, first.request.id);
  const duplicateInReview = requestAccountDeletion(workspaceId, owner.id, "Tercer intento", t1 + 20_000);
  assert.equal(duplicateInReview.ok, true);
  assert.ok(duplicateInReview.ok);
  assert.equal(duplicateInReview.created, false);
  assert.equal(duplicateInReview.request.id, first.request.id);
  assert.equal(duplicateInReview.request.status, "in_review");

  const count = db.prepare(`
    SELECT count(*) AS total FROM demo_deletion_requests
    WHERE workspace_id = ? AND account_id = ?
  `).get(workspaceId, owner.id) as { total: number };
  assert.equal(count.total, 1);

  // Solo el titular puede consultar su propia solicitud
  assert.equal(getMyDeletionRequest(workspaceId, owner.id)?.id, first.request.id);
  assert.equal(getMyDeletionRequest(workspaceId, other.id, owner.id), null);
  assert.equal(getMyDeletionRequest("other-workspace", owner.id), null);

  // Tras resolver una solicitud, se permite registrar una nueva solicitud abierta
  db.prepare(`
    UPDATE demo_deletion_requests
    SET status = 'resolved', resolution_note = 'Revisada', resolved_by = 'organizer', resolved_at = ?
    WHERE workspace_id = ? AND id = ?
  `).run(t1 + 30_000, workspaceId, first.request.id);
  const afterResolved = requestAccountDeletion(workspaceId, owner.id, "Nueva petición", t1 + 40_000);
  assert.equal(afterResolved.ok, true);
  assert.ok(afterResolved.ok);
  assert.equal(afterResolved.created, true);
  assert.notEqual(afterResolved.request.id, first.request.id);
  assert.equal(getMyDeletionRequest(workspaceId, owner.id)?.id, afterResolved.request.id);
});
