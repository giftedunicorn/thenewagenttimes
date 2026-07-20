"use client";

import NiceModal from "@ebay/nice-modal-react";

import "~/app/_components/Modals";

import { TRPCReactProvider } from "~/trpc/react";
import { AuthProvider } from "./auth-provider";
import { LinguiClientProvider } from "./lingui-client-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LinguiClientProvider>
      <TRPCReactProvider>
        <AuthProvider>
          <NiceModal.Provider>{children}</NiceModal.Provider>
        </AuthProvider>
      </TRPCReactProvider>
    </LinguiClientProvider>
  );
}
