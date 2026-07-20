import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("admin session route", () => {
  it("rejects a missing token before initializing Firebase Admin", async () => {
    const response = await POST(
      new Request("https://admin.example.com/api/auth/session", {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
  });
});
