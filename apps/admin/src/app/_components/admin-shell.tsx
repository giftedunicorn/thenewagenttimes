"use client";

import { useState } from "react";

import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import { ThemeToggle } from "@acme/ui/theme";

import { useAdminAuth } from "~/providers/auth-provider";
import { MobileNavigation } from "./mobile-navigation";
import { Sidebar } from "./sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { loading, logout, user } = useAdminAuth();

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className={cn(
          "transition-[padding] duration-200",
          sidebarCollapsed ? "md:pl-16" : "md:pl-60",
        )}
      >
        <header className="bg-background/90 sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b px-4 backdrop-blur md:px-6">
          <MobileNavigation />
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm sm:block">
              {loading ? "Checking session…" : user?.email}
            </span>
            <ThemeToggle />
            <Button
              disabled={loading}
              onClick={() => void logout()}
              size="sm"
              variant="outline"
            >
              Sign out
            </Button>
          </div>
        </header>
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
