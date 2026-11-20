import { readAccountCodeEmail } from "../../server/auth/form-context";
import { VerifyEmailView } from "./view";

export const metadata = { title: "Verificar correo" };

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams;
  const email = await readAccountCodeEmail("verification");

  return <VerifyEmailView params={params} email={email} />;
}
