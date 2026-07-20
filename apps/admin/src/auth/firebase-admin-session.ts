import { env } from "~/env";
import { createAdminSessionReader } from "./admin-session";
import { getFirebaseAdminAuth } from "./firebase-admin";

export const readAdminSession = createAdminSessionReader((sessionCookie) =>
  getFirebaseAdminAuth(env.FIREBASE_SERVICE_ACCOUNT_JSON).verifySessionCookie(
    sessionCookie,
    true,
  ),
);
