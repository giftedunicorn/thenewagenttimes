"use client";

import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { firebaseClientAuth } from "~/auth/firebase-client";

interface AdminAuthContextValue {
  loading: boolean;
  logout: () => Promise<void>;
  user: User | null;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(
    () =>
      onAuthStateChanged(firebaseClientAuth, (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      }),
    [],
  );

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      loading,
      async logout() {
        await fetch("/api/auth/session", { method: "DELETE" });
        await signOut(firebaseClientAuth);
        queryClient.clear();
        router.replace("/login");
        router.refresh();
      },
      user,
    }),
    [loading, queryClient, router, user],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used within AuthProvider");
  }

  return context;
};
