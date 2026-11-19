import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

export function BackLink({ href, children }) {
  return (
    <Link className="back-link" href={href}>
      <HugeiconsIcon icon={ArrowLeft02Icon} size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
      <span>{children}</span>
    </Link>
  );
}
