import type { Metadata, Viewport } from "next";

import { cn } from "@acme/ui";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";
import { newsStructuredDataDefaultBaseUrl } from "./_components/news-structured-data";

import "~/app/styles.css";

const getNewsSiteBaseUrl = () => {
  const deploymentHost =
    env.RAILWAY_PUBLIC_DOMAIN ??
    env.VERCEL_PROJECT_PRODUCTION_URL ??
    env.VERCEL_URL;
  const trimmedHost = deploymentHost?.trim().replace(/\/+$/, "");

  if (!trimmedHost) return newsStructuredDataDefaultBaseUrl;

  return /^https?:\/\//i.test(trimmedHost)
    ? trimmedHost
    : `https://${trimmedHost}`;
};

const newsSiteBaseUrl = getNewsSiteBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(newsSiteBaseUrl),
  alternates: {
    types: {
      "application/feed+json": "/feed.json",
      "application/rss+xml": "/rss.xml",
    },
  },
  title: "The New AI Times",
  description:
    "A personalized front page for AI agents, frontier models, funding, research, launches, and market shifts.",
  openGraph: {
    title: "The New AI Times",
    description:
      "A personalized front page for AI agents, frontier models, funding, research, launches, and market shifts.",
    url: newsSiteBaseUrl,
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
      <head>
        <link
          href="/opensearch.xml"
          rel="search"
          title="The New AI Times"
          type="application/opensearchdescription+xml"
        />
      </head>
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
