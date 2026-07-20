"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { Button } from "@acme/ui/button";

import { firebaseClientAuth } from "~/auth/firebase-client";
import { getAdminLoginErrorMessage } from "~/auth/login-errors";

export default function LoginClient() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithPopup(
        firebaseClientAuth,
        new GoogleAuthProvider(),
      );
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        body: JSON.stringify({ idToken }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("admin-access-denied");
        }
        throw new Error("session-exchange-failed");
      }

      router.replace("/");
      router.refresh();
    } catch (signInError) {
      setError(getAdminLoginErrorMessage(signInError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <section className="bg-card text-card-foreground w-full max-w-sm rounded-xl border p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-4 flex size-11 items-center justify-center rounded-lg text-sm font-bold">
            AI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sign in with your authorized Google account.
          </p>
        </div>

        {error ? (
          <p
            className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={loading}
          onClick={handleGoogleSignIn}
          size="lg"
          variant="outline"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
              fill="#4285F4"
            />
            <path
              d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.25-2.53c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.6-4.13H3.05v2.6A10 10 0 0 0 12 22Z"
              fill="#34A853"
            />
            <path
              d="M6.4 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.32-1.87v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.47l3.35-2.6Z"
              fill="#FBBC05"
            />
            <path
              d="M12 6c1.47 0 2.79.5 3.83 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.95 5.53l3.35 2.6A6 6 0 0 1 12 6Z"
              fill="#EA4335"
            />
          </svg>
          {loading ? "Signing in…" : "Sign in with Google"}
        </Button>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Admin access only
        </p>
      </section>
    </main>
  );
}
