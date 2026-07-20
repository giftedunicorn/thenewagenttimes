import {
  Activity,
  Database,
  LayoutDashboard,
  ListTodo,
  Newspaper,
  Users,
} from "lucide-react";

export const ADMIN_NAVIGATION = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/ingestion", icon: Activity, label: "Ingestion" },
  { href: "/jobs", icon: ListTodo, label: "Jobs" },
  { href: "/content", icon: Newspaper, label: "Content" },
  { href: "/sources", icon: Database, label: "Sources" },
  { href: "/users", icon: Users, label: "Users" },
] as const;

export const isNavigationActive = (
  pathname: string,
  href: (typeof ADMIN_NAVIGATION)[number]["href"],
) => (href === "/" ? pathname === href : pathname.startsWith(href));
