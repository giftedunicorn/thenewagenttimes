import type { Metadata, Viewport } from "next";

import { cn } from "@acme/ui";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

const productionUrl =
  env.RAILWAY_PUBLIC_DOMAIN ??
  env.VERCEL_PROJECT_PRODUCTION_URL ??
  env.VERCEL_URL ??
  "thenewagenttimes.com";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.NODE_ENV === "production"
      ? `https://${productionUrl}`
      : "http://localhost:3000",
  ),
  title: "The New AI Times",
  description:
    "A personalized front page for AI agents, frontier models, funding, research, launches, and market shifts.",
  openGraph: {
    title: "The New AI Times",
    description:
      "A personalized front page for AI agents, frontier models, funding, research, launches, and market shifts.",
    url: `https://${productionUrl}`,
    siteName: "The New AI Times",
  },
  twitter: {
    card: "summary_large_image",
    site: "@thenewaitimes",
    creator: "@thenewaitimes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
        )}
      >
        <ThemeProvider>
          <TRPCReactProvider>{props.children}</TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
