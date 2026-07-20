import "server-only";

import { createFirebaseAdminSessionReader } from "@acme/auth/firebase-session";

import { env } from "~/env";

export const getFirebaseSession = createFirebaseAdminSessionReader(
  env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
);
