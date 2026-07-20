"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { env } from "~/env";

const FIREBASE_ADMIN_CLIENT_APP = "thenewaitimes-admin-client";
const app =
  getApps().find((candidate) => candidate.name === FIREBASE_ADMIN_CLIENT_APP) ??
  initializeApp(
    {
      apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
      appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
      authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    FIREBASE_ADMIN_CLIENT_APP,
  );

export const firebaseClientAuth = getAuth(app);
