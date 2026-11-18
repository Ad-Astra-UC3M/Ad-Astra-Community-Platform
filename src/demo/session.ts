import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import {
  type DemoUser,
  SessionStore,
  opaqueToken,
  readSignIn,
  readSignUp,
  sessionSeconds,
  tokenHash,
  verificationSeconds,
} from "./session-store";

type CookieJar = Awaited<ReturnType<typeof cookies>>;

const store = new SessionStore(db);
const workspaceCookie = "community_demo_workspace";
const sessionCookie = "community_demo_session";
const verificationCookie = "community_demo_verification";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

function readToken(jar: CookieJar, name: string) {
  const token = jar.get(name)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function workspaceFrom(jar: CookieJar) {
  const token = readToken(jar, workspaceCookie);
  return token ? tokenHash(token) : null;
}

function ensureWorkspace(jar: CookieJar) {
  const existing = workspaceFrom(jar);
  if (existing) return existing;
  const token = opaqueToken();
  jar.set(workspaceCookie, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  return tokenHash(token);
}

function startSession(jar: CookieJar, user: DemoUser): never {
  const previous = readToken(jar, sessionCookie);
  const token = store.openSession(user);
  if (previous) store.closeSession(user.workspaceId, previous);
  jar.set(sessionCookie, token, { ...cookieOptions, maxAge: sessionSeconds });
  redirect(user.role === "organizer" ? "/admin" : "/home");
}

export async function currentUser(): Promise<DemoUser | null> {
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, sessionCookie);
  return workspaceId && token ? store.sessionUser(workspaceId, token) : null;
}

export async function requireUser(): Promise<DemoUser> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function signUp(form: FormData) {
  "use server";

  const result = readSignUp(form);
  if (!result.ok) redirect("/sign-up?error=" + result.error);

  const jar = await cookies();
  const workspaceId = ensureWorkspace(jar);
  const token = opaqueToken();
  if (!store.createAccount(workspaceId, result.input, token)) redirect("/sign-up?error=duplicate");

  jar.set(verificationCookie, token, { ...cookieOptions, maxAge: verificationSeconds });
  redirect("/verify-email");
}

export async function hasPendingVerification() {
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, verificationCookie);
  return Boolean(workspaceId && token && store.hasPendingVerification(workspaceId, token));
}

export async function verifyEmail() {
  "use server";

  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, verificationCookie);
  const user = workspaceId && token ? store.verifyAccount(workspaceId, token) : null;
  jar.delete(verificationCookie);
  if (!user) redirect("/verify-email");

  startSession(jar, user);
}

export async function signIn(form: FormData) {
  "use server";

  const credentials = readSignIn(form);
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const user = workspaceId && credentials
    ? store.signIn(workspaceId, credentials.email, credentials.password)
    : null;
  if (!user) redirect("/sign-in?error=credentials");

  startSession(jar, user);
}

async function enterDemo(role: DemoUser["role"]) {
  const jar = await cookies();
  const workspaceId = ensureWorkspace(jar);
  startSession(jar, store.demoUser(workspaceId, role));
}

export async function demoStudent() {
  "use server";

  await enterDemo("student");
}

export async function demoOrganizer() {
  "use server";

  await enterDemo("organizer");
}

export async function signOut() {
  "use server";

  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, sessionCookie);
  if (workspaceId && token) store.closeSession(workspaceId, token);
  jar.delete(sessionCookie);
  redirect("/");
}
