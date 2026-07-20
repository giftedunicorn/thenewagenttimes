"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";

import { isValidLoginEmail } from "~/auth/firebase-client";
import { emailForSignInKey } from "~/providers/auth-provider";
import { getFirebaseAuth } from "~/utils/firebase-config";

type CallbackStatus = "error" | "loading" | "needs-email";

export function EmailCallback() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const { t } = useLingui();

  const completeSignIn = useCallback(async (address: string) => {
    try {
      const auth = await getFirebaseAuth();
      const { signInWithEmailLink } = await import("firebase/auth");

      await signInWithEmailLink(auth, address, window.location.href);
      window.localStorage.removeItem(emailForSignInKey);
      window.location.replace("/");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void getFirebaseAuth()
      .then(async (auth) => {
        const { isSignInWithEmailLink } = await import("firebase/auth");
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setStatus("error");
          return;
        }

        const storedEmail = window.localStorage.getItem(emailForSignInKey);
        if (!storedEmail) {
          setStatus("needs-email");
          return;
        }

        await completeSignIn(storedEmail);
      })
      .catch(() => setStatus("error"));
  }, [completeSignIn]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidLoginEmail(email)) return;

    setStatus("loading");
    void completeSignIn(email.trim().toLowerCase());
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#faf9f6] px-4 text-[#171717] dark:bg-[#0d0d0d] dark:text-[#f5f3ed]">
      <section className="w-full max-w-md border border-[#171717] bg-white p-6 shadow-xl sm:p-8 dark:border-[#f5f3ed] dark:bg-[#151515]">
        <p className="font-mono text-xs font-bold tracking-[0.18em] text-[#8b1e18] uppercase dark:text-[#ff8378]">
          <Trans>The New AI Times</Trans>
        </p>

        {status === "loading" ? (
          <>
            <h1 className="mt-3 font-serif text-3xl font-black">
              <Trans>Signing you in</Trans>
            </h1>
            <p className="mt-3 text-sm text-[#625f59] dark:text-[#b9b5ad]">
              <Trans>Please wait while we verify your secure link.</Trans>
            </p>
          </>
        ) : null}

        {status === "needs-email" ? (
          <>
            <h1 className="mt-3 font-serif text-3xl font-black">
              <Trans>Confirm your email</Trans>
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#625f59] dark:text-[#b9b5ad]">
              <Trans>
                Enter the email address that received this sign-in link.
              </Trans>
            </p>
            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <Input
                aria-label={t`Email address`}
                autoComplete="email"
                className="h-11 rounded-none"
                placeholder={t`Email address`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button
                className="h-11 w-full rounded-none bg-[#8b1e18] text-white hover:bg-[#6f1712]"
                disabled={!isValidLoginEmail(email)}
                type="submit"
              >
                <Trans>Finish signing in</Trans>
              </Button>
            </form>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <h1 className="mt-3 font-serif text-3xl font-black">
              <Trans>This sign-in link is no longer valid</Trans>
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#625f59] dark:text-[#b9b5ad]">
              <Trans>Return home and request a fresh secure link.</Trans>
            </p>
            <Button
              asChild
              className="mt-5 h-11 w-full rounded-none"
              variant="outline"
            >
              <Link href="/">
                <Trans>Return home</Trans>
              </Link>
            </Button>
          </>
        ) : null}
      </section>
    </main>
  );
}
