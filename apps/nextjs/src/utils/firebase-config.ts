import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";

import { shouldUseFirebaseRedirect } from "~/auth/firebase-client";
import { env } from "~/env";

const appName = "thenewaitimes";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseAuthPromise: Promise<Auth> | null = null;

const getAuthDomain = () => {
  if (
    typeof window !== "undefined" &&
    shouldUseFirebaseRedirect(window.navigator.userAgent)
  ) {
    return window.location.host;
  }

  return env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
};

const initializeFirebaseAuth = async () => {
  const [{ getApp, getApps, initializeApp }, authModule] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);
  firebaseApp =
    firebaseApp ??
    (getApps().some((app) => app.name === appName)
      ? getApp(appName)
      : initializeApp(
          {
            apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
            appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
            authDomain: getAuthDomain(),
            messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          },
          appName,
        ));
  firebaseAuth = authModule.getAuth(firebaseApp);

  await authModule
    .setPersistence(firebaseAuth, authModule.indexedDBLocalPersistence)
    .catch(() => undefined);

  return firebaseAuth;
};

export function getFirebaseAuth() {
  if (firebaseAuth) return Promise.resolve(firebaseAuth);

  firebaseAuthPromise ??= initializeFirebaseAuth();

  return firebaseAuthPromise;
}
