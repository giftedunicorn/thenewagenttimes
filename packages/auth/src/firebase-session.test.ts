import { describe, expect, it, vi } from "vitest";

import type {
  FirebaseIdentity,
  FirebaseUserRecord,
  FirebaseUserStore,
} from "./firebase-session";
import {
  createFirebaseSessionReader,
  readFirebaseBearerToken,
  resolveFirebaseUser,
  validateFirebaseClaims,
} from "./firebase-session";

const identity = (
  overrides: Partial<FirebaseIdentity> = {},
): FirebaseIdentity => ({
  email: "reader@example.com",
  emailVerified: true,
  expiresAt: new Date("2026-07-20T12:00:00.000Z"),
  image: "https://example.com/reader.png",
  name: "AI Reader",
  uid: "firebase-reader",
  ...overrides,
});

class MemoryFirebaseUserStore implements FirebaseUserStore {
  readonly links = new Map<string, string>();
  readonly users = new Map<string, FirebaseUserRecord>();

  findByEmail(email: string) {
    return Promise.resolve(
      [...this.users.values()].find(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      ) ?? null,
    );
  }

  findByFirebaseUid(uid: string) {
    const userId = this.links.get(uid);
    return Promise.resolve(
      userId ? (this.users.get(userId) ?? null) : null,
    );
  }

  async createUser(input: FirebaseUserRecord) {
    const existing = await this.findByEmail(input.email);
    if (existing) return existing;

    this.users.set(input.id, input);
    return input;
  }

  linkFirebaseUid(uid: string, userId: string) {
    this.links.set(uid, userId);
    return Promise.resolve(this.users.get(userId) ?? null);
  }
}

describe("readFirebaseBearerToken", () => {
  it("returns null when the Authorization header is missing or malformed", () => {
    expect(readFirebaseBearerToken(new Headers())).toBeNull();
    expect(
      readFirebaseBearerToken(
        new Headers({ authorization: "Basic credential" }),
      ),
    ).toBeNull();
    expect(
      readFirebaseBearerToken(new Headers({ authorization: "Bearer" })),
    ).toBeNull();
  });

  it("returns the Firebase token without the Bearer scheme", () => {
    expect(
      readFirebaseBearerToken(
        new Headers({ authorization: "Bearer verified-token" }),
      ),
    ).toBe("verified-token");
  });
});

describe("validateFirebaseClaims", () => {
  it("rejects identities without a verified email", () => {
    expect(
      validateFirebaseClaims({
        email_verified: true,
        exp: 1_784_569_600,
        uid: "reader",
      }),
    ).toBeNull();
    expect(
      validateFirebaseClaims({
        email: "reader@example.com",
        email_verified: false,
        exp: 1_784_569_600,
        uid: "reader",
      }),
    ).toBeNull();
  });

  it("normalizes verified Firebase claims", () => {
    expect(
      validateFirebaseClaims({
        email: " Reader@Example.COM ",
        email_verified: true,
        exp: 1_784_569_600,
        name: " AI Reader ",
        picture: "https://example.com/reader.png",
        uid: "reader",
      }),
    ).toEqual({
      email: "reader@example.com",
      emailVerified: true,
      expiresAt: new Date(1_784_569_600_000),
      image: "https://example.com/reader.png",
      name: "AI Reader",
      uid: "reader",
    });
  });
});

describe("resolveFirebaseUser", () => {
  it("reuses an existing Firebase account mapping", async () => {
    const store = new MemoryFirebaseUserStore();
    store.users.set("app-user", {
      email: "reader@example.com",
      emailVerified: true,
      id: "app-user",
      image: null,
      name: "Existing Reader",
    });
    store.links.set("firebase-reader", "app-user");

    await expect(resolveFirebaseUser(identity(), store)).resolves.toMatchObject(
      {
        id: "app-user",
        name: "Existing Reader",
      },
    );
    expect(store.users).toHaveLength(1);
  });

  it("links a new Firebase UID to an existing normalized email", async () => {
    const store = new MemoryFirebaseUserStore();
    store.users.set("existing-user", {
      email: "reader@example.com",
      emailVerified: false,
      id: "existing-user",
      image: null,
      name: "Existing Reader",
    });

    await expect(
      resolveFirebaseUser(
        identity({ email: "READER@example.com", uid: "new-firebase-uid" }),
        store,
      ),
    ).resolves.toMatchObject({ id: "existing-user" });
    expect(store.links.get("new-firebase-uid")).toBe("existing-user");
    expect(store.users).toHaveLength(1);
  });

  it("creates one application user and reuses it on later requests", async () => {
    const store = new MemoryFirebaseUserStore();

    const firstUser = await resolveFirebaseUser(identity(), store);
    const nextUser = await resolveFirebaseUser(identity(), store);

    expect(firstUser.id).toBe(nextUser.id);
    expect(store.users).toHaveLength(1);
    expect(store.links.get("firebase-reader")).toBe(firstUser.id);
  });
});

describe("createFirebaseSessionReader", () => {
  it("keeps requests without a Firebase token anonymous", async () => {
    const verifyIdToken = vi.fn();
    const reader = createFirebaseSessionReader({
      store: new MemoryFirebaseUserStore(),
      verifyIdToken,
    });

    await expect(reader(new Headers())).resolves.toBeNull();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns the linked application user for a verified Firebase token", async () => {
    const store = new MemoryFirebaseUserStore();
    const reader = createFirebaseSessionReader({
      store,
      verifyIdToken: vi.fn().mockResolvedValue({
        email: "reader@example.com",
        email_verified: true,
        exp: 1_784_569_600,
        name: "AI Reader",
        picture: "https://example.com/reader.png",
        uid: "firebase-reader",
      }),
    });

    const session = await reader(
      new Headers({ authorization: "Bearer verified-firebase-token" }),
    );

    expect(session).toMatchObject({
      expiresAt: new Date(1_784_569_600_000),
      user: {
        email: "reader@example.com",
        name: "AI Reader",
      },
    });
    expect(session?.user.id).toBeTypeOf("string");
  });

  it("fails closed when Firebase rejects the token", async () => {
    const reader = createFirebaseSessionReader({
      store: new MemoryFirebaseUserStore(),
      verifyIdToken: vi.fn().mockRejectedValue(new Error("expired token")),
    });

    await expect(
      reader(new Headers({ authorization: "Bearer expired-token" })),
    ).resolves.toBeNull();
  });
});
