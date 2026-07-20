"use client";

import NiceModal from "@ebay/nice-modal-react";
import { Trans, useLingui } from "@lingui/react/macro";

import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";

import { useAuth } from "~/providers/auth-provider";
import { Modals } from "./Modals";

const getInitials = (name: string | null, email: string | null) =>
  (name ?? email ?? "R")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function AuthMenu() {
  const { t } = useLingui();
  const { signOut, status, user } = useAuth();

  if (status === "loading") {
    return (
      <Button className="h-8 rounded-none" disabled size="sm" variant="outline">
        <Trans>Loading account</Trans>
      </Button>
    );
  }

  if (!user) {
    return (
      <Button
        className="h-8 rounded-none border-[#171717] bg-transparent hover:bg-[#8b1e18] hover:text-white dark:border-[#f5f3ed]"
        size="sm"
        type="button"
        variant="outline"
        onClick={() => void NiceModal.show(Modals.LoginModal)}
      >
        <Trans>Sign in</Trans>
      </Button>
    );
  }

  const initials = getInitials(user.displayName, user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t`Open account menu`}
          className="size-8 overflow-hidden rounded-full border-[#171717] p-0 dark:border-[#f5f3ed]"
          size="icon"
          variant="outline"
        >
          {user.photoURL ? (
            <span
              aria-label={t`Account image`}
              className="size-full bg-cover bg-center"
              role="img"
              style={{ backgroundImage: `url("${user.photoURL}")` }}
            />
          ) : (
            <span className="grid size-full place-items-center bg-[#8b1e18] font-mono text-[11px] font-bold text-white">
              {initials}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block">
            <Trans>Reader account</Trans>
          </span>
          <span className="text-muted-foreground mt-1 block truncate text-xs font-normal">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <Trans>Sign out</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
