import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  ALL_CAPABILITIES,
  SessionStore,
  readSignUp,
  sanitizeNextPath,
} from "./session-store";

function createStudent(store: SessionStore, workspaceId: string, email = "lucia@alumnos.uc3m.es", now = 1_700_000_000_000) {
  const form = new FormData();
  form.set("firstName", "Lucía");
  form.set("lastName", "Ejemplo");
  form.set("email", email);
  form.set("degree", "Ingeniería Aeroespacial");
  form.set("course", "2.º");
  form.set("password", "ComunidadDemo2026!");
  form.set("privacy", "accepted");
  const parsed = readSignUp(form);
  assert.ok(parsed.ok);
  assert.equal(store.createAccount(workspaceId, parsed.input, `verify-${email}`, now), true);
  const user = store.verifyAccount(workspaceId, `verify-${email}`, now);
  assert.ok(user);
  return { user, input: parsed.input };
}

test("CA-01: las 4 capacidades son independientes y general_admin nunca concede talent_consultation", () => {
  assert.deepEqual(ALL_CAPABILITIES, [
    "general_admin",
    "content_editing",
    "attendance_validation",
    "talent_consultation",
  ]);

  using database = new DatabaseSync(":memory:");
  const store = new SessionStore(database);
  const now = 1_700_000_000_000;

  const organizer = store.demoUser("ws-a", "organizer");
  assert.deepEqual(organizer.capabilities, [
    "general_admin",
    "content_editing",
    "attendance_validation",
  ]);
  assert.equal(organizer.capabilities.includes("talent_consultation"), false);
  assert.equal(organizer.status, "active");

  const { user: student } = createStudent(store, "ws-a", "ana@alumnos.uc3m.es", now);
  assert.deepEqual(student.capabilities, []);
  assert.equal(student.status, "active");

  store.setCapability("ws-a", student.id, "general_admin", true, organizer.id, now + 10);
  assert.deepEqual(store.getCapabilities("ws-a", student.id), ["general_admin"]);
  assert.equal(store.getCapabilities("ws-a", student.id).includes("talent_consultation"), false);

  store.setCapability("ws-a", student.id, "talent_consultation", true, organizer.id, now + 20);
  assert.deepEqual(store.getCapabilities("ws-a", student.id), [
    "general_admin",
    "talent_consultation",
  ]);

  const token = store.openSession(student, now + 30);
  assert.deepEqual(store.sessionUser("ws-a", token, now + 30)?.capabilities, [
    "general_admin",
    "talent_consultation",
  ]);

  store.setCapability("ws-a", student.id, "general_admin", false, organizer.id, now + 40);
  assert.deepEqual(store.sessionUser("ws-a", token, now + 40)?.capabilities, [
    "talent_consultation",
  ]);

  // Al revocar todas las capacidades del organizador demo, no deben reasignarse al volver a consultar demoUser.
  for (const cap of organizer.capabilities) {
    store.setCapability("ws-a", organizer.id, cap, false, organizer.id, now + 50);
  }
  assert.deepEqual(store.getCapabilities("ws-a", organizer.id), []);
  assert.deepEqual(store.demoUser("ws-a", "organizer").capabilities, []);
});

test("CA-01: los cambios de capacidades registran auditoría con actor y fecha aislada por espacio", () => {
  using database = new DatabaseSync(":memory:");
  const store = new SessionStore(database);
  const now = 1_700_000_000_000;

  const organizerA = store.demoUser("ws-a", "organizer");
  const organizerB = store.demoUser("ws-b", "organizer");
  const { user: studentA } = createStudent(store, "ws-a", "auditoria@alumnos.uc3m.es", now);
  const { user: studentB } = createStudent(store, "ws-b", "auditoria@alumnos.uc3m.es", now);

  store.setCapability("ws-a", studentA.id, "content_editing", true, organizerA.id, now + 1);
  // Repetir la concesión cuando ya está activa no genera auditoría redundante.
  store.setCapability("ws-a", studentA.id, "content_editing", true, organizerA.id, now + 2);
  store.setCapability("ws-a", studentA.id, "content_editing", false, organizerA.id, now + 3);
  store.setCapability("ws-b", studentB.id, "attendance_validation", true, organizerB.id, now + 4);

  const auditA = store.listCapabilityAudit("ws-a", studentA.id);
  assert.equal(auditA.length, 2);
  assert.equal(auditA[0].action, "revoked");
  assert.equal(auditA[0].capability, "content_editing");
  assert.equal(auditA[0].actorId, organizerA.id);
  assert.equal(auditA[0].createdAt, now + 3);
  assert.equal(auditA[1].action, "granted");
  assert.equal(auditA[1].createdAt, now + 1);

  const allAuditB = store.listCapabilityAudit("ws-b");
  assert.equal(allAuditB.length, 1);
  assert.equal(allAuditB[0].targetAccountId, studentB.id);
});

test("CA-01: desactivar una cuenta revoca inmediatamente todas sus sesiones y bloquea el acceso", () => {
  using database = new DatabaseSync(":memory:");
  const store = new SessionStore(database);
  const now = 1_700_000_000_000;

  const organizer = store.demoUser("ws-a", "organizer");
  const { user: student, input } = createStudent(store, "ws-a", "baja@alumnos.uc3m.es", now);
  const { user: other } = createStudent(store, "ws-a", "activa@alumnos.uc3m.es", now + 1);

  const s1 = store.openSession(student, now + 10);
  const s2 = store.openSession(student, now + 11);
  const otherSession = store.openSession(other, now + 12);

  assert.equal(store.isAccountActive("ws-a", student.id), true);
  assert.equal(store.setAccountStatus("ws-a", student.id, "deactivated", organizer.id, now + 20), true);
  assert.equal(store.isAccountActive("ws-a", student.id), false);

  assert.equal(store.sessionUser("ws-a", s1, now + 21), null);
  assert.equal(store.sessionUser("ws-a", s2, now + 21), null);
  assert.equal(store.signIn("ws-a", input.email, input.password), null);
  assert.equal(store.requestPasswordReset("ws-a", input.email, "reset-deactivated", now + 22), false);
  // La sesión de otra cuenta no se ve afectada.
  assert.equal(store.sessionUser("ws-a", otherSession, now + 21)?.id, other.id);

  // Reactivar permite volver a autenticarse, pero no revive sesiones previas revocadas.
  assert.equal(store.setAccountStatus("ws-a", student.id, "active", organizer.id, now + 30), true);
  assert.equal(store.isAccountActive("ws-a", student.id), true);
  assert.equal(store.sessionUser("ws-a", s1, now + 31), null);
  assert.equal(store.signIn("ws-a", input.email, input.password)?.id, student.id);
});

test("CA-01: la migración segura añade status y columnas de recuperación a tablas previas", () => {
  using database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE demo_accounts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'organizer')),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      degree TEXT,
      course TEXT,
      password_hash TEXT,
      privacy_version TEXT,
      privacy_accepted_at INTEGER,
      verification_hash TEXT,
      verification_expires_at INTEGER,
      verified_at INTEGER,
      UNIQUE (workspace_id, email),
      UNIQUE (workspace_id, id)
    ) STRICT;
    INSERT INTO demo_accounts (id, workspace_id, role, first_name, last_name, verified_at)
    VALUES ('legacy-1', 'ws-legacy', 'student', 'Elena', 'Previa', 1700000000000);
  `);

  const store = new SessionStore(database);
  assert.equal(store.isAccountActive("ws-legacy", "legacy-1"), true);
  assert.deepEqual(store.getCapabilities("ws-legacy", "legacy-1"), []);
});

test("CA-02: la recuperación de contraseña es de un solo uso e invalida las sesiones previas", () => {
  using database = new DatabaseSync(":memory:");
  const store = new SessionStore(database);
  const now = 1_700_000_000_000;

  const { user: student, input } = createStudent(store, "ws-a", "recuperar@alumnos.uc3m.es", now);
  const { user: other } = createStudent(store, "ws-a", "otra@alumnos.uc3m.es", now + 1);

  const oldSession1 = store.openSession(student, now + 5);
  const oldSession2 = store.openSession(student, now + 6);
  const otherSession = store.openSession(other, now + 7);

  // Correo desconocido o en otro espacio no genera recuperación.
  assert.equal(store.requestPasswordReset("ws-a", "noexiste@alumnos.uc3m.es", "tok-missing", now + 10), false);
  assert.equal(store.requestPasswordReset("ws-b", input.email, "tok-wrong-ws", now + 10), false);

  assert.equal(store.requestPasswordReset("ws-a", input.email.toUpperCase(), "tok-valid", now + 10), true);
  assert.equal(store.hasPendingPasswordReset("ws-a", "tok-valid", now + 11), true);
  assert.equal(store.hasPendingPasswordReset("ws-b", "tok-valid", now + 11), false);
  assert.equal(store.hasPendingPasswordReset("ws-a", "tok-valid", now + 20 * 60_000), false);

  // Una contraseña inválida no consume el token ni cierra sesiones.
  assert.equal(store.resetPassword("ws-a", "tok-valid", "corta", now + 12), false);
  assert.equal(store.hasPendingPasswordReset("ws-a", "tok-valid", now + 12), true);
  assert.equal(store.sessionUser("ws-a", oldSession1, now + 12)?.id, student.id);

  // Un token caducado no permite restablecer.
  assert.equal(store.resetPassword("ws-a", "tok-valid", "NuevaClaveSegura2026!", now + 20 * 60_000), false);

  // Restablecimiento válido actualiza la contraseña, invalida el token y cierra sesiones previas.
  assert.equal(store.resetPassword("ws-a", "tok-valid", "NuevaClaveSegura2026!", now + 20), true);
  assert.equal(store.hasPendingPasswordReset("ws-a", "tok-valid", now + 21), false);
  assert.equal(store.resetPassword("ws-a", "tok-valid", "OtraClaveMas2026!", now + 22), false);

  assert.equal(store.sessionUser("ws-a", oldSession1, now + 23), null);
  assert.equal(store.sessionUser("ws-a", oldSession2, now + 23), null);
  assert.equal(store.sessionUser("ws-a", otherSession, now + 23)?.id, other.id);

  assert.equal(store.signIn("ws-a", input.email, input.password), null);
  assert.equal(store.signIn("ws-a", input.email, "NuevaClaveSegura2026!")?.id, student.id);
});

test("CA-03: sanitizeNextPath acepta rutas internas seguras y rechaza URLs externas o //", () => {
  assert.equal(sanitizeNextPath("/activities"), "/activities");
  assert.equal(sanitizeNextPath("/activities/cubesat-lab?shift=1#turnos"), "/activities/cubesat-lab?shift=1#turnos");
  assert.equal(sanitizeNextPath("  /opportunities?q=cohete  "), "/opportunities?q=cohete");
  assert.equal(sanitizeNextPath("/admin/talent/user-1"), "/admin/talent/user-1");

  assert.equal(sanitizeNextPath("//evil.example/phish"), "/home");
  assert.equal(sanitizeNextPath("///evil.example/phish"), "/home");
  assert.equal(sanitizeNextPath("https://evil.example/home"), "/home");
  assert.equal(sanitizeNextPath("http://evil.example"), "/home");
  assert.equal(sanitizeNextPath("javascript:alert(1)"), "/home");
  assert.equal(sanitizeNextPath("/\\evil.example"), "/home");
  assert.equal(sanitizeNextPath("activities"), "/home");
  assert.equal(sanitizeNextPath(""), "/home");
  assert.equal(sanitizeNextPath(null), "/home");
  assert.equal(sanitizeNextPath(undefined), "/home");
  assert.equal(sanitizeNextPath("/home\r\nLocation: https://evil.example"), "/home");

  assert.equal(sanitizeNextPath("https://evil.example", "/admin"), "/admin");
  assert.equal(sanitizeNextPath("https://evil.example", "https://bad.example"), "/home");
});
