import Image from "next/image";
import { PageHeading, pageClassName } from "./page-layout";

const illustrations = {
  access: { src: "/brand/auth-team.webp", width: 720, height: 360 },
  registration: { src: "/brand/auth-community.webp", width: 600, height: 554 },
};

export function AccessPage({ title, children, artwork = "access" }) {
  return (
    <main className={pageClassName}>
      <div className="mx-auto grid w-full max-w-[66rem] gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
        <div className="grid min-w-0 content-start gap-6">
          <PageHeading title={title} />
          {children}
        </div>
        <div className="grid min-w-0 place-items-center rounded-lg bg-brand-panel p-6 md:min-h-80">
          <Image
            {...illustrations[artwork]}
            sizes="(min-width: 48rem) 44vw, 100vw"
            alt=""
            className="h-auto max-h-48 w-full object-contain md:max-h-[28rem]"
          />
        </div>
      </div>
    </main>
  );
}
