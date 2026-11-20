import { readAccountCodeEmail } from "../../lib/auth/session";
import { VerifyEmailView } from "./view";

export const metadata = { title: "Verificar correo" };

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams;
  const email = await readAccountCodeEmail("verification");

  return <VerifyEmailView params={params} email={email} />;
}
