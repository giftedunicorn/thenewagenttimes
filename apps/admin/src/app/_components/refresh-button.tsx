import { Button } from "@acme/ui/button";

export function RefreshButton({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Button
      disabled={isRefreshing}
      onClick={onRefresh}
      size="sm"
      variant="outline"
    >
      {isRefreshing ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
