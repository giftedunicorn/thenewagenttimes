import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { ADMIN_SESSION_COOKIE } from "./auth/admin-session";
import { proxy } from "./proxy";

describe("admin proxy", () => {
  it("redirects an anonymous page request to login", () => {
    const response = proxy(new NextRequest("https://admin.example.com/jobs"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/login",
    );
  });

  it.each(["/login", "/api/trpc/overview.get", "/_next/static/app.js"])(
    "allows the public path %s",
    (pathname) => {
      const response = proxy(
        new NextRequest(`https://admin.example.com${pathname}`),
      );

      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("allows a page request with an admin session cookie", () => {
    const request = new NextRequest("https://admin.example.com/jobs");
    request.cookies.set(ADMIN_SESSION_COOKIE, "firebase-session");

    const response = proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });
});
