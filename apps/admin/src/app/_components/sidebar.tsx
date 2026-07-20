"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";

import { ADMIN_NAVIGATION, isNavigationActive } from "./navigation";

export function Sidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-30 hidden border-r transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b px-3",
          collapsed ? "justify-center" : "justify-between gap-3",
        )}
      >
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-3">
            <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
              AI
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold">The New AI Times</p>
              <p className="text-sidebar-foreground/60 text-xs">Operations</p>
            </div>
          </div>
        )}
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="size-8 shrink-0"
          onClick={() => onCollapsedChange(!collapsed)}
          size="icon"
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 space-y-1 p-3">
        {ADMIN_NAVIGATION.map((item) => {
          const active = isNavigationActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
              href={item.href}
              key={item.href}
              title={collapsed ? item.label : undefined}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
