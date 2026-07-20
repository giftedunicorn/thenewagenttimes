import type { SessionReader } from "./session";

export interface FirebaseIdentity {
  email: string;
  emailVerified: true;
  expiresAt: Date;
  image: string | null;
  name: string;
  uid: string;
}

export interface FirebaseUserRecord {
  email: string;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string;
}

export interface FirebaseUserStore {
  createUser: (input: FirebaseUserRecord) => Promise<FirebaseUserRecord>;
  findByEmail: (email: string) => Promise<FirebaseUserRecord | null>;
  findByFirebaseUid: (uid: string) => Promise<FirebaseUserRecord | null>;
  linkFirebaseUid: (
    uid: string,
    userId: string,
  ) => Promise<FirebaseUserRecord | null>;
}

export interface FirebaseTokenClaims {
  email?: unknown;
  email_verified?: unknown;
  exp?: unknown;
  name?: unknown;
  picture?: unknown;
  uid?: unknown;
}

interface FirebaseSessionReaderOptions {
  store: FirebaseUserStore;
  verifyIdToken: (token: string) => Promise<FirebaseTokenClaims>;
}

export function readFirebaseBearerToken(headers: Headers) {
  const authorization = headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);

  return match?.[1] ?? null;
}

export function validateFirebaseClaims(
  claims: FirebaseTokenClaims,
): FirebaseIdentity | null {
  const uid = typeof claims.uid === "string" ? claims.uid.trim() : "";
  const email = typeof claims.email === "string" ? claims.email.trim() : "";
  const expiration =
    typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims.exp
      : null;

  if (!uid || !email || claims.email_verified !== true || expiration === null) {
    return null;
  }

  const normalizedEmail = email.toLowerCase();
  const claimName = typeof claims.name === "string" ? claims.name.trim() : "";
  const fallbackName = normalizedEmail.split("@")[0] ?? "Reader";

  return {
    email: normalizedEmail,
    emailVerified: true,
    expiresAt: new Date(expiration * 1000),
    image: typeof claims.picture === "string" ? claims.picture : null,
    name: claimName || fallbackName,
    uid,
  };
}

export async function resolveFirebaseUser(
  identity: FirebaseIdentity,
  store: FirebaseUserStore,
) {
  const mappedUser = await store.findByFirebaseUid(identity.uid);
  if (mappedUser) return mappedUser;

  const existingUser = await store.findByEmail(identity.email);
  const user =
    existingUser ??
    (await store.createUser({
      email: identity.email,
      emailVerified: identity.emailVerified,
      id: crypto.randomUUID(),
      image: identity.image,
      name: identity.name,
    }));
  const linkedUser = await store.linkFirebaseUid(identity.uid, user.id);

  if (linkedUser) return linkedUser;

  const concurrentlyLinkedUser = await store.findByFirebaseUid(identity.uid);
  if (concurrentlyLinkedUser) return concurrentlyLinkedUser;

  throw new Error("Failed to link Firebase identity");
}

export function createFirebaseSessionReader({
  store,
  verifyIdToken,
}: FirebaseSessionReaderOptions): SessionReader {
  return async (headers) => {
    const token = readFirebaseBearerToken(headers);
    if (!token) return null;

    try {
      const claims = await verifyIdToken(token);
      const identity = validateFirebaseClaims(claims);
      if (!identity) return null;

      const user = await resolveFirebaseUser(identity, store);

      return {
        expiresAt: identity.expiresAt,
        user,
      };
    } catch {
      return null;
    }
  };
}
