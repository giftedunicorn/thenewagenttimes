import type { Metadata, Viewport } from "next";

import { cn } from "@acme/ui";

import { Providers } from "~/providers/providers";

import "./styles.css";

export const metadata: Metadata = {
  description: "Operations dashboard for The New AI Times.",
  title: {
    default: "Admin · The New AI Times",
    template: "%s · The New AI Times",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { color: "white", media: "(prefers-color-scheme: light)" },
    { color: "black", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
