import { cookies } from "next/headers";
import { normalizeUc3mEmail, sanitizeNextPath } from "./uc3m";

const accountCodeCookies = {
  verification: { name: "ada-verification-email", path: "/verify-email" },
  recovery: { name: "ada-recovery-email", path: "/reset-password" },
};

type AccountCodeFlow = keyof typeof accountCodeCookies;

export async function readAccountCodeEmail(flow: AccountCodeFlow): Promise<string> {
  const jar = await cookies();
  return normalizeUc3mEmail(jar.get(accountCodeCookies[flow].name)?.value) ?? "";
}

export async function setAccountCodeEmail(flow: AccountCodeFlow, rawEmail: string): Promise<void> {
  const email = normalizeUc3mEmail(rawEmail);
  const jar = await cookies();
  jar.set({
    ...accountCodeCookies[flow],
    value: email ?? "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: email ? 10 * 60 : 0,
  });
}

export function readOptionalNextPath(value: unknown): string {
  if (typeof value !== "string") return "";
  const path = value.trim();
  return sanitizeNextPath(path) === path ? path : "";
}
