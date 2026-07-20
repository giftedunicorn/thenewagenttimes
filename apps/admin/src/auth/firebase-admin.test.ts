import { describe, expect, it } from "vitest";

import { parseFirebaseServiceAccount } from "./firebase-admin";

describe("parseFirebaseServiceAccount", () => {
  it("parses a Railway JSON secret and restores private-key newlines", () => {
    expect(
      parseFirebaseServiceAccount(
        JSON.stringify({
          client_email: "firebase-admin@example.com",
          private_key: "first-line\\nsecond-line\\n",
          project_id: "the-new-ai-times",
        }),
      ),
    ).toEqual({
      clientEmail: "firebase-admin@example.com",
      privateKey: "first-line\nsecond-line\n",
      projectId: "the-new-ai-times",
    });
  });

  it("rejects malformed service-account JSON", () => {
    expect(() => parseFirebaseServiceAccount("not-json")).toThrow(
      "FIREBASE_SERVICE_ACCOUNT_JSON",
    );
  });

  it("rejects incomplete service-account credentials", () => {
    expect(() =>
      parseFirebaseServiceAccount(
        JSON.stringify({
          client_email: "firebase-admin@example.com",
          project_id: "the-new-ai-times",
        }),
      ),
    ).toThrow("FIREBASE_SERVICE_ACCOUNT_JSON");
  });
});
