import NextLink from "next/link";
export function Link({ to, ...props }) {
  return <NextLink {...props} href={to} />;
}
