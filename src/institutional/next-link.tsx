import NextLink from "next/link";
import type { ComponentProps } from "react";

type NextLinkProps = ComponentProps<typeof NextLink>;
type LinkProps = Omit<NextLinkProps, "href"> & { to: NextLinkProps["href"] };

export function Link({ to, ...props }: LinkProps) {
  return <NextLink {...props} href={to} />;
}
