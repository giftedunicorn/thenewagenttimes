import { getFirebaseAdminAuth } from "~/auth/firebase-admin";
import {
  handleAdminSessionDelete,
  handleAdminSessionPost,
} from "~/auth/session-handler";
import { env } from "~/env";

export const POST = (request: Request) => {
  const getAuth = () => getFirebaseAdminAuth(env.FIREBASE_SERVICE_ACCOUNT_JSON);

  return handleAdminSessionPost({
    adminEmails: env.ADMIN_EMAILS,
    createSessionCookie: (idToken, expiresIn) =>
      getAuth().createSessionCookie(idToken, { expiresIn }),
    request,
    secure: env.NODE_ENV === "production",
    verifyIdToken: (idToken) => getAuth().verifyIdToken(idToken),
  });
};

export const DELETE = () =>
  handleAdminSessionDelete({
    secure: env.NODE_ENV === "production",
  });
