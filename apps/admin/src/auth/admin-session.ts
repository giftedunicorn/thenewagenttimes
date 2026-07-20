import type { AdminIdentity, AdminSessionReader } from "@acme/admin-api";

export const ADMIN_SESSION_COOKIE = "session";

export interface FirebaseSessionClaims {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  uid: string;
}

type VerifySessionCookie = (
  sessionCookie: string,
) => Promise<FirebaseSessionClaims>;

const readCookie = (headers: Headers, name: string) => {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;

    const key = cookie.slice(0, separator).trim();
    if (key !== name) continue;

    const value = cookie.slice(separator + 1).trim();
    if (!value) return null;

    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return null;
};

const toAdminIdentity = (
  claims: FirebaseSessionClaims,
): AdminIdentity | null => {
  const email = claims.email?.trim().toLowerCase();

  if (!email || claims.email_verified !== true || !claims.uid.trim()) {
    return null;
  }

  let image = claims.picture?.trim() ?? null;
  if (image === "") image = null;

  let name = claims.name?.trim() ?? email;
  if (name === "") name = email;

  return {
    email,
    image,
    name,
    uid: claims.uid,
  };
};

export const createAdminSessionReader =
  (verifySessionCookie: VerifySessionCookie): AdminSessionReader =>
  async (headers) => {
    const sessionCookie = readCookie(headers, ADMIN_SESSION_COOKIE);
    if (!sessionCookie) return null;

    try {
      return toAdminIdentity(await verifySessionCookie(sessionCookie));
    } catch {
      return null;
    }
  };
