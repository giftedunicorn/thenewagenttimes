import { describe, expect, it, vi } from "vitest";

import {
  createFirebaseAuthorizationHeaders,
  isValidLoginEmail,
  shouldUseFirebaseRedirect,
} from "./firebase-client";

describe("createFirebaseAuthorizationHeaders", () => {
  it("omits Authorization when no Firebase user is signed in", async () => {
    const headers = await createFirebaseAuthorizationHeaders(null);

    expect(headers.has("authorization")).toBe(false);
    expect(headers.get("x-trpc-source")).toBe("nextjs-react");
  });

  it("attaches the current Firebase ID token", async () => {
    const getIdToken = vi.fn().mockResolvedValue("real-firebase-token");
    const headers = await createFirebaseAuthorizationHeaders({ getIdToken });

    expect(getIdToken).toHaveBeenCalledOnce();
    expect(headers.get("authorization")).toBe("Bearer real-firebase-token");
  });
});

describe("isValidLoginEmail", () => {
  it("accepts a normal address and rejects incomplete or oversized input", () => {
    expect(isValidLoginEmail("reader@example.com")).toBe(true);
    expect(isValidLoginEmail("reader@")).toBe(false);
    expect(isValidLoginEmail(`${"reader".repeat(50)}@example.com`)).toBe(false);
  });
});

describe("shouldUseFirebaseRedirect", () => {
  it("uses redirect for iOS WebKit browsers", () => {
    expect(
      shouldUseFirebaseRedirect(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      ),
    ).toBe(true);
    expect(
      shouldUseFirebaseRedirect(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      ),
    ).toBe(false);
  });
});
