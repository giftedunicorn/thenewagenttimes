import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionReader,
} from "./admin-session";
import {
  ADMIN_SESSION_EXPIRES_IN_MS,
  handleAdminSessionDelete,
  handleAdminSessionPost,
} from "./session-handler";

const createRequest = (body: unknown) =>
  new Request("https://admin.example.com/api/auth/session", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

const verifiedToken = {
  email: "admin@example.com",
  email_verified: true,
  name: "Admin",
  uid: "firebase-admin",
};

describe("handleAdminSessionPost", () => {
  it("rejects a missing ID token", async () => {
    const response = await handleAdminSessionPost({
      adminEmails: "admin@example.com",
      createSessionCookie: vi.fn(),
      request: createRequest({}),
      secure: true,
      verifyIdToken: vi.fn(),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "ID token is required",
    });
  });

  it("rejects an identity without a verified email", async () => {
    const response = await handleAdminSessionPost({
      adminEmails: "admin@example.com",
      createSessionCookie: vi.fn(),
      request: createRequest({ idToken: "firebase-id-token" }),
      secure: true,
      verifyIdToken: vi.fn(() =>
        Promise.resolve({
          ...verifiedToken,
          email_verified: false,
        }),
      ),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a verified identity outside the administrator allowlist", async () => {
    const response = await handleAdminSessionPost({
      adminEmails: "admin@example.com",
      createSessionCookie: vi.fn(),
      request: createRequest({ idToken: "firebase-id-token" }),
      secure: true,
      verifyIdToken: vi.fn(() =>
        Promise.resolve({
          ...verifiedToken,
          email: "reader@example.com",
        }),
      ),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("exchanges an allowed token for a secure 14-day session cookie", async () => {
    const createSessionCookie = vi.fn(() =>
      Promise.resolve("firebase-session"),
    );
    const response = await handleAdminSessionPost({
      adminEmails: " ADMIN@example.com ",
      createSessionCookie,
      request: createRequest({ idToken: "firebase-id-token" }),
      secure: true,
      verifyIdToken: vi.fn(() => Promise.resolve(verifiedToken)),
    });

    expect(response.status).toBe(200);
    expect(createSessionCookie).toHaveBeenCalledWith(
      "firebase-id-token",
      ADMIN_SESSION_EXPIRES_IN_MS,
    );
    expect(response.headers.get("set-cookie")).toContain(
      `${ADMIN_SESSION_COOKIE}=firebase-session`,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain(
      `Max-Age=${ADMIN_SESSION_EXPIRES_IN_MS / 1_000}`,
    );
  });

  it("returns a generic error when Firebase rejects the exchange", async () => {
    const response = await handleAdminSessionPost({
      adminEmails: "admin@example.com",
      createSessionCookie: vi.fn(),
      request: createRequest({ idToken: "firebase-id-token" }),
      secure: true,
      verifyIdToken: vi.fn(() => Promise.reject(new Error("provider details"))),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to create session",
    });
  });
});

describe("handleAdminSessionDelete", () => {
  it("expires the admin session cookie", () => {
    const response = handleAdminSessionDelete({ secure: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      `${ADMIN_SESSION_COOKIE}=`,
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("createAdminSessionReader", () => {
  it("returns a verified Firebase session identity from the request cookie", async () => {
    const reader = createAdminSessionReader(() =>
      Promise.resolve(verifiedToken),
    );
    const headers = new Headers({
      cookie: `${ADMIN_SESSION_COOKIE}=firebase-session`,
    });

    await expect(reader(headers)).resolves.toEqual({
      email: "admin@example.com",
      image: null,
      name: "Admin",
      uid: "firebase-admin",
    });
  });

  it("fails closed when the session cookie is invalid", async () => {
    const reader = createAdminSessionReader(() =>
      Promise.reject(new Error("expired")),
    );

    await expect(
      reader(
        new Headers({
          cookie: `${ADMIN_SESSION_COOKIE}=expired-session`,
        }),
      ),
    ).resolves.toBeNull();
  });
});
