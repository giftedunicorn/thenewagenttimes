import { describe, expect, it } from "vitest";

import { toUserViewModel, usersListInput } from "./users";

describe("usersListInput", () => {
  it("accepts bounded search and pagination", () => {
    expect(
      usersListInput.parse({
        page: 0,
        pageSize: 50,
        search: "  admin@example.com  ",
      }),
    ).toEqual({
      page: 0,
      pageSize: 50,
      search: "admin@example.com",
    });

    expect(() => usersListInput.parse({ page: 0, pageSize: 51 })).toThrow();
    expect(() =>
      usersListInput.parse({
        page: 0,
        pageSize: 20,
        search: "x".repeat(161),
      }),
    ).toThrow();
  });
});

describe("toUserViewModel", () => {
  it("returns only the operational identity and reader contract", () => {
    expect(
      toUserViewModel({
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
        email: "admin@example.com",
        emailVerified: true,
        firebaseLinked: true,
        id: "user-1",
        image: null,
        interactionCount: 12,
        latestInteractionAt: new Date("2026-07-20T11:00:00.000Z"),
        name: "Admin",
        readerProfile: true,
      }),
    ).toEqual({
      createdAt: "2026-07-20T10:00:00.000Z",
      email: "admin@example.com",
      emailVerified: true,
      firebaseLinked: true,
      id: "user-1",
      image: null,
      interactionCount: 12,
      latestInteractionAt: "2026-07-20T11:00:00.000Z",
      name: "Admin",
      readerProfile: true,
    });
  });
});
