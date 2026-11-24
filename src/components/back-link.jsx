import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

export function BackLink({ href, children }) {
  return (
    <Link
      className="inline-flex min-h-[44px] items-center justify-self-start gap-2 text-brand-primary underline underline-offset-4 transition-colors hover:text-brand-ink"
      href={href}
    >
      <HugeiconsIcon
        className="shrink-0"
        icon={ArrowLeft02Icon}
        size={20}
        strokeWidth={2}
        aria-hidden="true"
        focusable="false"
      />
      <span>{children}</span>
    </Link>
  );
}
