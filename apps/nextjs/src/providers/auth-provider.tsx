"use client";

import type { User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { shouldUseFirebaseRedirect } from "~/auth/firebase-client";
import { getFirebaseAuth } from "~/utils/firebase-config";

const redirectPendingKey = "thenewaitimes_auth_redirect_pending";
export const emailForSignInKey = "thenewaitimes_email_for_sign_in";

type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthContextValue {
  sendSignInLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  status: AuthStatus;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    void getFirebaseAuth()
      .then(async (auth) => {
        const { getRedirectResult, onAuthStateChanged } = await import(
          "firebase/auth"
        );

        if (window.localStorage.getItem(redirectPendingKey)) {
          window.localStorage.removeItem(redirectPendingKey);
          await getRedirectResult(auth);
        }

        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          if (!active) return;

          setUser(nextUser);
          setStatus(nextUser ? "signed-in" : "signed-out");
          void queryClient.invalidateQueries();
          router.refresh();
        });
      })
      .catch(() => {
        if (active) setStatus("signed-out");
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [queryClient, router]);

  const signInWithGoogle = useCallback(async () => {
    const auth = await getFirebaseAuth();
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } =
      await import("firebase/auth");
    const provider = new GoogleAuthProvider();

    if (shouldUseFirebaseRedirect(window.navigator.userAgent)) {
      window.localStorage.setItem(redirectPendingKey, "google");
      await signInWithRedirect(auth, provider);
      return;
    }

    await signInWithPopup(auth, provider);
  }, []);

  const sendSignInLink = useCallback(async (email: string) => {
    const auth = await getFirebaseAuth();
    const { sendSignInLinkToEmail } = await import("firebase/auth");
    const normalizedEmail = email.trim().toLowerCase();

    window.localStorage.setItem(emailForSignInKey, normalizedEmail);
    await sendSignInLinkToEmail(auth, normalizedEmail, {
      handleCodeInApp: true,
      url: `${window.location.origin}/auth/callback`,
    });
  }, []);

  const signOut = useCallback(async () => {
    const auth = await getFirebaseAuth();
    const { signOut: firebaseSignOut } = await import("firebase/auth");

    await firebaseSignOut(auth);
    queryClient.clear();
    router.push("/");
  }, [queryClient, router]);

  const value = useMemo(
    () => ({
      sendSignInLink,
      signInWithGoogle,
      signOut,
      status,
      user,
    }),
    [sendSignInLink, signInWithGoogle, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
