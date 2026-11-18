import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

type BackLinkProps = {
  href: string;
  children: string;
};

export function BackLink({ href, children }: BackLinkProps) {
  return (
    <Link className="back-link" href={href}>
      <HugeiconsIcon icon={ArrowLeft02Icon} size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
      <span>{children}</span>
    </Link>
  );
}
