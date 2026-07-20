import type { db as dbClient } from "@acme/db/client";
import { and, eq, sql } from "@acme/db";
import { account, user } from "@acme/db/schema";

import type { FirebaseUserRecord, FirebaseUserStore } from "./firebase-session";
import type { SessionReader } from "./session";
import {
  createFirebaseSessionReader,
  readFirebaseBearerToken,
} from "./firebase-session";

type DbClient = typeof dbClient;

const firebaseUserSelection = {
  email: user.email,
  emailVerified: user.emailVerified,
  id: user.id,
  image: user.image,
  name: user.name,
};

export function createDrizzleFirebaseUserStore(
  db: DbClient,
): FirebaseUserStore {
  const findByEmail = async (
    email: string,
  ): Promise<FirebaseUserRecord | null> =>
    (
      await db
        .select(firebaseUserSelection)
        .from(user)
        .where(sql`lower(${user.email}) = ${email.toLowerCase()}`)
        .limit(1)
    )[0] ?? null;

  const findByFirebaseUid = async (
    uid: string,
  ): Promise<FirebaseUserRecord | null> =>
    (
      await db
        .select(firebaseUserSelection)
        .from(account)
        .innerJoin(user, eq(account.userId, user.id))
        .where(
          and(eq(account.providerId, "firebase"), eq(account.accountId, uid)),
        )
        .limit(1)
    )[0] ?? null;

  return {
    async createUser(input) {
      const now = new Date();
      const createdUser = (
        await db
          .insert(user)
          .values({
            ...input,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing({ target: user.email })
          .returning(firebaseUserSelection)
      )[0];

      if (createdUser) return createdUser;

      const existingUser = await findByEmail(input.email);
      if (existingUser) return existingUser;

      throw new Error("Failed to create Firebase application user");
    },
    findByEmail,
    findByFirebaseUid,
    async linkFirebaseUid(uid, userId) {
      const now = new Date();

      await db
        .insert(account)
        .values({
          accountId: uid,
          createdAt: now,
          id: `firebase:${uid}`,
          providerId: "firebase",
          updatedAt: now,
          userId,
        })
        .onConflictDoNothing({ target: account.id });

      return findByFirebaseUid(uid);
    },
  };
}

export function createFirebaseAdminSessionReader(
  projectId: string,
): SessionReader {
  let readerPromise: Promise<SessionReader> | undefined;

  const loadReader = async () => {
    const [{ db }, { getApps, initializeApp }, { getAuth }] = await Promise.all(
      [
        import("@acme/db/client"),
        import("firebase-admin/app"),
        import("firebase-admin/auth"),
      ],
    );
    const appName = `thenewaitimes-auth-${projectId}`;
    const app =
      getApps().find((candidate) => candidate.name === appName) ??
      initializeApp({ projectId }, appName);

    return createFirebaseSessionReader({
      store: createDrizzleFirebaseUserStore(db),
      verifyIdToken: (token) => getAuth(app).verifyIdToken(token),
    });
  };

  return async (headers) => {
    if (!readFirebaseBearerToken(headers)) return null;

    readerPromise ??= loadReader();

    return (await readerPromise)(headers);
  };
}
