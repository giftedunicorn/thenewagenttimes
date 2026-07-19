import { describe, expect, it } from "vitest";

import { parseWorkerConfig } from "./config";

describe("parseWorkerConfig", () => {
  it("uses the worker defaults", () => {
    expect(
      parseWorkerConfig({}, { generateWorkerId: () => "generated-worker" }),
    ).toEqual({
      concurrency: 1,
      embedLimit: 25,
      errorSleepMs: 15_000,
      heartbeatMs: 60_000,
      idleSleepMs: 5_000,
      leaseDurationMs: 300_000,
      workerId: "generated-worker",
    });
  });

  it("parses bounded positive integer values", () => {
    expect(
      parseWorkerConfig({
        BACKGROUND_WORKER_ERROR_MS: "60000",
        BACKGROUND_WORKER_HEARTBEAT_MS: "30000",
        BACKGROUND_WORKER_IDLE_MS: "100",
        BACKGROUND_WORKER_LEASE_MS: "3600000",
        BACKGROUND_WORKER_ID: " worker-one ",
        NEWS_EMBED_LIMIT: "100",
      }),
    ).toEqual({
      concurrency: 1,
      embedLimit: 100,
      errorSleepMs: 60_000,
      heartbeatMs: 30_000,
      idleSleepMs: 100,
      leaseDurationMs: 3_600_000,
      workerId: "worker-one",
    });
  });

  it("falls back when integer values are invalid or out of bounds", () => {
    expect(
      parseWorkerConfig(
        {
          BACKGROUND_WORKER_ERROR_MS: "60001",
          BACKGROUND_WORKER_HEARTBEAT_MS: "4999",
          BACKGROUND_WORKER_IDLE_MS: "1.5",
          BACKGROUND_WORKER_LEASE_MS: "119999",
          NEWS_EMBED_LIMIT: "101",
        },
        { generateWorkerId: () => "generated-worker" },
      ),
    ).toEqual({
      concurrency: 1,
      embedLimit: 25,
      errorSleepMs: 15_000,
      heartbeatMs: 60_000,
      idleSleepMs: 5_000,
      leaseDurationMs: 300_000,
      workerId: "generated-worker",
    });
  });

  it.each([
    ["1", 1],
    ["100", 100],
    ["0", 25],
    ["101", 25],
    ["1.5", 25],
  ])("bounds NEWS_EMBED_LIMIT value %s", (value, expected) => {
    expect(
      parseWorkerConfig(
        { NEWS_EMBED_LIMIT: value },
        { generateWorkerId: () => "generated-worker" },
      ).embedLimit,
    ).toBe(expected);
  });

  it("requires the heartbeat to be strictly shorter than the lease", () => {
    const config = parseWorkerConfig(
      {
        BACKGROUND_WORKER_HEARTBEAT_MS: "30000",
        BACKGROUND_WORKER_LEASE_MS: "120000",
      },
      { generateWorkerId: () => "generated-worker" },
    );

    expect(config.heartbeatMs).toBe(30_000);
    expect(config.heartbeatMs).toBeLessThanOrEqual(
      Math.floor(config.leaseDurationMs / 3),
    );
  });

  it.each([
    ["5000", 5_000],
    ["40000", 40_000],
    ["40001", 40_000],
  ])(
    "bounds heartbeat value %s to one third of the lease",
    (value, expected) => {
      expect(
        parseWorkerConfig(
          {
            BACKGROUND_WORKER_HEARTBEAT_MS: value,
            BACKGROUND_WORKER_LEASE_MS: "120000",
          },
          { generateWorkerId: () => "generated-worker" },
        ).heartbeatMs,
      ).toBe(expected);
    },
  );

  it("generates a UUID when the worker ID is blank", () => {
    expect(parseWorkerConfig({ BACKGROUND_WORKER_ID: "   " }).workerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
