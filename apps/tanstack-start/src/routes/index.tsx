import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@acme/ui/button";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-3 border-b pb-6">
          <p className="text-muted-foreground text-sm font-medium uppercase">
            Railway fallback shell
          </p>
          <h1 className="text-4xl font-semibold tracking-normal sm:text-6xl">
            The New AI Times
          </h1>
          <p className="text-muted-foreground max-w-2xl text-base leading-7 sm:text-lg">
            This legacy TanStack Start shell is retained only as a monorepo
            fallback. The production news product is the Next.js app deployed
            through the root Railway commands.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-l pl-4">
            <p className="text-sm font-semibold">Build</p>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              pnpm run deploy:nextjs
            </p>
          </div>
          <div className="border-l pl-4">
            <p className="text-sm font-semibold">Start</p>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              pnpm run start:nextjs
            </p>
          </div>
          <div className="border-l pl-4">
            <p className="text-sm font-semibold">Service</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Use the repository root or the checked-in Railway fallback config.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a
              href="https://railway.com"
              rel="nofollow noopener noreferrer"
              target="_blank"
            >
              Railway
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://nextjs.org"
              rel="nofollow noopener noreferrer"
              target="_blank"
            >
              Next.js
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
