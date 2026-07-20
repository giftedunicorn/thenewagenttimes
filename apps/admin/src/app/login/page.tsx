import type { Metadata } from "next";

import LoginClient from "./login-client";

export const metadata: Metadata = {
  title: "Admin Login · The New AI Times",
  description: "Sign in to The New AI Times admin dashboard.",
};

export default function LoginPage() {
  return <LoginClient />;
}
