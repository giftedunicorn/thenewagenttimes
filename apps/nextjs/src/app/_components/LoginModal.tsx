"use client";

import { useEffect, useState } from "react";
import NiceModal, { useModal } from "@ebay/nice-modal-react";

import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";
import { Separator } from "@acme/ui/separator";
import { toast } from "@acme/ui/toast";

import { isValidLoginEmail } from "~/auth/firebase-client";
import { useAuth } from "~/providers/auth-provider";

const LoginModal = NiceModal.create(() => {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const modal = useModal();
  const { sendSignInLink, signInWithGoogle, status } = useAuth();

  useEffect(() => {
    if (status === "signed-in") {
      void modal.hide();
    }
  }, [modal, status]);

  const handleGoogleLogin = async () => {
    setPending(true);
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Google sign-in failed", {
        description: "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!isValidLoginEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }

    setPending(true);
    try {
      await sendSignInLink(email);
      setSent(true);
    } catch {
      toast.error("Email link could not be sent", {
        description: "Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={modal.visible}
      onOpenChange={(open) => {
        if (!open) void modal.hide();
      }}
    >
      <DialogContent
        className="overflow-hidden border-[#171717] bg-[#faf9f6] p-0 text-[#171717] sm:max-w-[460px] dark:border-[#f5f3ed] dark:bg-[#111] dark:text-[#f5f3ed]"
        closeLabel="Close"
      >
        <div className="border-b border-[#171717]/25 px-6 py-6 sm:px-8 dark:border-white/20">
          <p className="font-mono text-xs font-bold tracking-[0.18em] text-[#8b1e18] uppercase dark:text-[#ff8378]">
            Reader account
          </p>
          <DialogTitle className="mt-2 font-serif text-3xl font-black">
            Welcome to The New AI Times
          </DialogTitle>
          <DialogDescription className="mt-3 leading-6 text-[#625f59] dark:text-[#b9b5ad]">
            Sign in to keep your saved stories and recommendations with you.
          </DialogDescription>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          {sent ? (
            <div
              className="border border-[#171717]/25 bg-white/60 p-5 dark:border-white/20 dark:bg-white/5"
              role="status"
            >
              <p className="font-serif text-xl font-bold">Check your inbox</p>
              <p className="mt-2 text-sm leading-6 text-[#625f59] dark:text-[#b9b5ad]">
                Open the secure link we sent to finish signing in.
              </p>
            </div>
          ) : (
            <>
              <Button
                className="h-11 w-full rounded-none border-[#171717]/40 bg-white text-[#171717] hover:bg-[#f0ede6] dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                disabled={pending}
                type="button"
                variant="outline"
                onClick={() => void handleGoogleLogin()}
              >
                <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
                  <path
                    d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.32 2.98-7.37"
                    fill="#4285f4"
                  />
                  <path
                    d="M12 22c2.7 0 4.97-.9 6.62-2.4l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22"
                    fill="#34a853"
                  />
                  <path
                    d="M6.39 13.91A6 6 0 0 1 6.08 12c0-.66.11-1.31.31-1.91v-2.6H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.51z"
                    fill="#fbbc05"
                  />
                  <path
                    d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.49l3.35 2.6A5.96 5.96 0 0 1 12 5.96"
                    fill="#ea4335"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <Separator className="bg-[#171717]/20 dark:bg-white/20" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#faf9f6] px-3 text-xs text-[#625f59] uppercase dark:bg-[#111] dark:text-[#b9b5ad]">
                  Or
                </span>
              </div>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleEmailLogin();
                }}
              >
                <Input
                  aria-label="Email address"
                  autoComplete="email"
                  className="h-11 rounded-none border-[#171717]/40 bg-white dark:border-white/30 dark:bg-white/5"
                  disabled={pending}
                  placeholder="Email address"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Button
                  className="h-11 w-full rounded-none bg-[#8b1e18] text-white hover:bg-[#6f1712] dark:bg-[#9f2a22] dark:hover:bg-[#b3342a]"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "Please wait" : "Continue with Email"}
                </Button>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default LoginModal;
