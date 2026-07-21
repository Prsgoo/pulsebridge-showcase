import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { PulseLogger } from "pulsebridge";
import { createAuthGuard } from "./auth.js";

const VALID_KEY = "test-key-0123456789abcdef";
const CLIENT_ENV = {
  incoming: {
    socket: { remoteAddress: "10.0.0.1", remotePort: 1, remoteFamily: "IPv4" },
  },
};

const silentLogger: PulseLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function buildGuardedApp(): Hono {
  const guard = createAuthGuard(silentLogger);
  const app = new Hono();
  app.post("/guarded", guard.middleware, (c) => c.json({ ok: true }));
  return app;
}

function post(app: Hono, headers: Record<string, string> = {}) {
  return app.request("/guarded", { method: "POST", headers }, CLIENT_ENV);
}

beforeEach(() => {
  delete process.env["PULSEBRIDGE_API_KEY"];
});

afterEach(() => {
  delete process.env["PULSEBRIDGE_API_KEY"];
  vi.clearAllMocks();
});

describe("createAuthGuard when no key is configured", () => {
  it("should reject guarded requests with 503", async () => {
    const res = await post(buildGuardedApp(), { "X-Api-Key": "anything" });
    expect(res.status).toBe(503);
  });
});

describe("createAuthGuard when key is too short", () => {
  it("should treat a sub-16-character key as unconfigured", async () => {
    process.env["PULSEBRIDGE_API_KEY"] = "short";
    const res = await post(buildGuardedApp(), { "X-Api-Key": "short" });
    expect(res.status).toBe(503);
  });
});

describe("createAuthGuard with a valid key configured", () => {
  beforeEach(() => {
    process.env["PULSEBRIDGE_API_KEY"] = VALID_KEY;
  });

  it("should allow a request carrying the correct key", async () => {
    const res = await post(buildGuardedApp(), { "X-Api-Key": VALID_KEY });
    expect(res.status).toBe(200);
  });

  it("should reject a request with a wrong key", async () => {
    const res = await post(buildGuardedApp(), {
      "X-Api-Key": "wrong-but-long-enough-key",
    });
    expect(res.status).toBe(401);
  });

  it("should reject a request with no key header", async () => {
    const res = await post(buildGuardedApp());
    expect(res.status).toBe(401);
  });

  it("should lock the client out with 429 after 10 failed attempts", async () => {
    const app = buildGuardedApp();
    let lastStatus = 0;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await post(app, { "X-Api-Key": "wrong-but-long-enough-key" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
