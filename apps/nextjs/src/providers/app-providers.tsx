"use client";

import NiceModal from "@ebay/nice-modal-react";

import "~/app/_components/Modals";

import { TRPCReactProvider } from "~/trpc/react";
import { AuthProvider } from "./auth-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <AuthProvider>
        <NiceModal.Provider>{children}</NiceModal.Provider>
      </AuthProvider>
    </TRPCReactProvider>
  );
}
