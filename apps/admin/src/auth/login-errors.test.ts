import { describe, expect, it } from "vitest";

import { getAdminLoginErrorMessage } from "./login-errors";

describe("getAdminLoginErrorMessage", () => {
  it("maps a cancelled popup without exposing provider details", () => {
    expect(
      getAdminLoginErrorMessage(
        new Error("Firebase: Error (auth/popup-closed-by-user)."),
      ),
    ).toBe("Sign-in cancelled.");
  });

  it("maps a blocked popup to a retryable instruction", () => {
    expect(
      getAdminLoginErrorMessage(
        new Error("Firebase: Error (auth/popup-blocked)."),
      ),
    ).toBe("Pop-up blocked. Allow pop-ups and try again.");
  });

  it("maps a denied session exchange to the access message", () => {
    expect(getAdminLoginErrorMessage(new Error("admin-access-denied"))).toBe(
      "This account does not have admin access.",
    );
  });

  it("uses a generic message for unknown provider failures", () => {
    expect(
      getAdminLoginErrorMessage(new Error("private provider detail")),
    ).toBe("Unable to sign in. Try again.");
  });
});
