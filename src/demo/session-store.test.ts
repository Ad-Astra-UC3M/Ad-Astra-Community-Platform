import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { SessionStore, readSignUp } from "./session-store";

function signUpForm(email = "Demo@Alumnos.UC3M.ES") {
  const form = new FormData();
  form.set("firstName", "Lucía");
  form.set("lastName", "Ejemplo");
  form.set("email", email);
  form.set("degree", "Ingeniería Aeroespacial");
  form.set("course", "2.º");
  form.set("password", "ComunidadDemo2026!");
  form.set("privacy", "accepted");
  return form;
}

function registration() {
  const result = readSignUp(signUpForm());
  assert.ok(result.ok);
  return result.input;
}

test("el alta exige el aviso y un correo del dominio UC3M o de un subdominio", () => {
  assert.equal(registration().email, "demo@alumnos.uc3m.es");
  assert.equal(readSignUp(signUpForm("demo@uc3m.es")).ok, true);
  assert.deepEqual(readSignUp(signUpForm("demo@fakeuc3m.es")), { ok: false, error: "email" });
  assert.deepEqual(readSignUp(signUpForm("demo@uc3m.es.example")), { ok: false, error: "email" });
  assert.deepEqual(readSignUp(signUpForm("demo@.uc3m.es")), { ok: false, error: "email" });
  const form = signUpForm();
  form.delete("privacy");
  assert.deepEqual(readSignUp(form), { ok: false, error: "privacy" });
});

test("el alta guarda la huella de la contraseña y el aviso, y exige una verificación de un solo uso", () => {
  using database = new DatabaseSync(":memory:");
  const store = new SessionStore(database);
  const input = registration();
  const now = Date.now();

  assert.equal(store.createAccount("workspace-a", input, "verification-a", now), true);
  assert.equal(store.createAccount("workspace-a", input, "verification-b", now), false);
  assert.equal(store.createAccount("workspace-b", input, "verification-b", now), true);

  const account = database.prepare(
    "SELECT password_hash, privacy_version, privacy_accepted_at, verification_hash FROM demo_accounts WHERE workspace_id = ?",
  ).get("workspace-a");
  assert.ok(account);
  assert.match(String(account.password_hash), /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.notEqual(account.verification_hash, "verification-a");
  assert.equal(account.privacy_version, "demo-1");
  assert.equal(account.privacy_accepted_at, now);
  assert.equal(store.signIn("workspace-a", input.email, input.password), null);

  assert.equal(store.hasPendingVerification("workspace-b", "verification-a", now), false);
  assert.equal(store.verifyAccount("workspace-b", "verification-a", now), null);
  assert.equal(store.verifyAccount("workspace-a", "verification-a", now + 60 * 60_000), null);
  assert.equal(store.hasPendingVerification("workspace-a", "verification-a", now), true);
  const user = store.verifyAccount("workspace-a", "verification-a", now);
  assert.equal(user?.name, "Lucía Ejemplo");
  assert.equal(user?.role, "student");
  assert.equal(store.verifyAccount("workspace-a", "verification-a", now), null);
  assert.equal(store.signIn("workspace-a", input.email, "incorrecta"), null);
  assert.deepEqual(store.signIn("workspace-a", input.email, input.password), user);
  assert.deepEqual(store.demoUser("workspace-a", "student"), user);
  assert.notEqual(store.demoUser("workspace-b", "student").id, user?.id);
});

test("las sesiones solo sirven en su espacio y se revocan al salir", () => {
  using database = new DatabaseSync(":memory:");
  const store = new SessionStore(database);
  const now = Date.now();
  const organizer = store.demoUser("workspace-a", "organizer");

  const token = store.openSession(organizer, now);
  assert.equal(store.sessionUser("workspace-b", token, now), null);
  assert.equal(store.sessionUser("workspace-a", "inventado", now), null);
  assert.deepEqual(store.sessionUser("workspace-a", token, now), organizer);
  assert.equal(store.sessionUser("workspace-a", token, now + 13 * 60 * 60_000), null);
  assert.notEqual(store.demoUser("workspace-a", "student").id, organizer.id);
  assert.equal(store.demoUser("workspace-a", "organizer").id, organizer.id);

  store.closeSession("workspace-b", token);
  assert.deepEqual(store.sessionUser("workspace-a", token, now), organizer);
  store.closeSession("workspace-a", token);
  assert.equal(store.sessionUser("workspace-a", token, now), null);
});
