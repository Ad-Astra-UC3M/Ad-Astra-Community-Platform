import { BackLink } from "../components/back-link";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <p className="text-[0.9rem] font-bold text-brand-primary">404</p>
      <h1>Página no encontrada</h1>
      <BackLink href="/">Volver al inicio</BackLink>
    </main>
  );
}
