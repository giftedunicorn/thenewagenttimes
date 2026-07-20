"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@acme/ui/sheet";

import { ADMIN_NAVIGATION, isNavigationActive } from "./navigation";

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="md:hidden" size="icon" variant="outline">
          <Menu aria-hidden="true" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-72 p-0" side="left">
        <SheetHeader className="border-b p-5 text-left">
          <SheetTitle>The New AI Times</SheetTitle>
          <SheetDescription>Admin operations</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile admin navigation" className="space-y-1 p-3">
          {ADMIN_NAVIGATION.map((item) => {
            const active = isNavigationActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <SheetClose asChild key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                    active && "bg-accent text-accent-foreground",
                  )}
                  href={item.href}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
