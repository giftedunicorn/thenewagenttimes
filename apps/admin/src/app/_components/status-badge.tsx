import { Badge } from "@acme/ui/badge";

type Status = "critical" | "degraded" | "healthy" | "neutral";

const STATUS_STYLES: Record<Status, string> = {
  critical:
    "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20",
  degraded:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  healthy:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({
  children,
  status,
}: {
  children: React.ReactNode;
  status: Status;
}) {
  return (
    <Badge className={STATUS_STYLES[status]} variant="outline">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}
