import { getNeonAuth } from "../../../../lib/auth/neon-auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type AuthRouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isForbiddenPath(rawSegments: string[], requestUrl: string): boolean {
  const decodedSegments = rawSegments
    .flatMap((segment) => decodeSegment(segment).split("/"))
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  if (
    decodedSegments.some(
      (segment) => segment === "." || segment === ".." || segment.includes("\\"),
    )
  ) {
    return true;
  }

  let urlPathAfterAuth = "";
  try {
    const pathname = decodeURIComponent(new URL(requestUrl).pathname).toLowerCase();
    const marker = "/api/auth/";
    const idx = pathname.indexOf(marker);
    if (idx !== -1) {
      urlPathAfterAuth = pathname.slice(idx + marker.length).replace(/^\/+|\/+$/g, "");
    }
  } catch {
    return true;
  }

  const candidates = new Set<string>([decodedSegments.join("/")]);
  if (urlPathAfterAuth) {
    candidates.add(urlPathAfterAuth);
  }

  for (const normalized of candidates) {
    if (
      normalized.startsWith("email-otp/") ||
      normalized === "sign-in/email-otp" ||
      normalized === "forget-password/email-otp" ||
      normalized === "change-email" ||
      normalized.startsWith("change-email/") ||
      normalized === "sign-up" ||
      normalized === "sign-up/email" ||
      normalized.startsWith("sign-up/") ||
      normalized === "delete-user" ||
      normalized.startsWith("delete-user/") ||
      normalized === "admin" ||
      normalized.startsWith("admin/")
    ) {
      return true;
    }
  }

  return false;
}

async function dispatchAuthRoute(
  method: AuthRouteMethod,
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const resolvedParams = await context.params;
  const pathSegments = Array.isArray(resolvedParams?.path)
    ? resolvedParams.path
    : [];

  if (isForbiddenPath(pathSegments, request.url)) {
    return Response.json(
      { error: "Operación no permitida en esta ruta de autenticación." },
      { status: 403 },
    );
  }

  const neonAuth = getNeonAuth();
  if (!neonAuth) {
    return Response.json(
      { error: "Proveedor remoto de autenticación no configurado." },
      { status: 404 },
    );
  }

  const handlers = neonAuth.handler();
  return handlers[method](request, { params: Promise.resolve({ path: pathSegments }) });
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return dispatchAuthRoute("GET", request, context);
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return dispatchAuthRoute("POST", request, context);
}

export function PUT(request: Request, context: RouteContext): Promise<Response> {
  return dispatchAuthRoute("PUT", request, context);
}

export function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return dispatchAuthRoute("DELETE", request, context);
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return dispatchAuthRoute("PATCH", request, context);
}
