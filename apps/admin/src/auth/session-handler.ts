import { parseAdminEmails } from "@acme/admin-api";

import type { FirebaseSessionClaims } from "./admin-session";
import { ADMIN_SESSION_COOKIE } from "./admin-session";

export const ADMIN_SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1_000;

interface HandleAdminSessionPostInput {
  adminEmails: string;
  createSessionCookie: (idToken: string, expiresIn: number) => Promise<string>;
  request: Request;
  secure: boolean;
  verifyIdToken: (idToken: string) => Promise<FirebaseSessionClaims>;
}

const serializeSessionCookie = ({
  maxAge,
  secure,
  value,
}: {
  maxAge: number;
  secure: boolean;
  value: string;
}) =>
  [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");

const readIdToken = async (request: Request) => {
  try {
    const body = (await request.json()) as unknown;

    if (typeof body !== "object" || body === null || !("idToken" in body)) {
      return null;
    }

    const idToken = body.idToken;
    return typeof idToken === "string" && idToken.trim()
      ? idToken.trim()
      : null;
  } catch {
    return null;
  }
};

export const handleAdminSessionPost = async ({
  adminEmails,
  createSessionCookie,
  request,
  secure,
  verifyIdToken,
}: HandleAdminSessionPostInput) => {
  const idToken = await readIdToken(request);

  if (!idToken) {
    return Response.json({ error: "ID token is required" }, { status: 400 });
  }

  try {
    const claims = await verifyIdToken(idToken);
    const email = claims.email?.trim().toLowerCase();

    if (
      !email ||
      claims.email_verified !== true ||
      !parseAdminEmails(adminEmails).has(email)
    ) {
      return Response.json(
        { error: "User does not have admin access" },
        { status: 403 },
      );
    }

    const sessionCookie = await createSessionCookie(
      idToken,
      ADMIN_SESSION_EXPIRES_IN_MS,
    );
    const response = Response.json({ success: true });
    response.headers.set(
      "set-cookie",
      serializeSessionCookie({
        maxAge: ADMIN_SESSION_EXPIRES_IN_MS / 1_000,
        secure,
        value: sessionCookie,
      }),
    );

    return response;
  } catch {
    return Response.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }
};

export const handleAdminSessionDelete = ({ secure }: { secure: boolean }) => {
  const response = Response.json({ success: true });
  response.headers.set(
    "set-cookie",
    [
      `${ADMIN_SESSION_COOKIE}=`,
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "HttpOnly",
      "SameSite=Lax",
      ...(secure ? ["Secure"] : []),
    ].join("; "),
  );

  return response;
};
