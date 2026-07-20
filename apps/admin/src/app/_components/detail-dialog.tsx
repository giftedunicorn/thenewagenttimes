"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@acme/ui/dialog";

import { PageState } from "./page-state";

export function DetailDialog({
  children,
  description,
  isError,
  isPending,
  onOpenChange,
  onRetry,
  open,
  title,
}: {
  children: React.ReactNode;
  description: string;
  isError: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden"
        closeLabel="Close"
      >
        <div className="shrink-0 space-y-1">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isPending ? (
            <PageState state="loading" />
          ) : isError ? (
            <PageState onRetry={onRetry} state="error" />
          ) : (
            children
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DetailGrid({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
      {rows.map((row) => (
        <div className="contents" key={row.label}>
          <dt className="text-muted-foreground font-medium">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ data, label }: { data: unknown; label: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      <pre className="bg-muted max-h-72 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {JSON.stringify(data ?? null, null, 2)}
      </pre>
    </section>
  );
}
