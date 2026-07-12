import { describe, it, expect } from "vitest";
import type { MiddlewareHandler } from "hono";
import type { PulseBridgeCore, PulseLogger } from "pulsebridge";
import {
  PluginAuthError,
  PluginInputError,
  RateLimitError,
  TransientError,
} from "pulsebridge";
import type { SseManager } from "./sseManager.js";
import { buildApp, type BuildAppOptions } from "./server.js";

const noopLogger: PulseLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const passThroughAuth: MiddlewareHandler = (_c, next) => next();

function fakeCore(overrides: Partial<PulseBridgeCore> = {}): PulseBridgeCore {
  return {
    getHealth: () => ({ status: "healthy", running: true, plugins: [] }),
    listPluginStates: () => [],
    getViews: async () => [],
    getView: async () => undefined,
    listIntegrationManifests: () => [],
    listProcessorManifests: () => [],
    getRecordsByType: async () => [],
    ...overrides,
  } as unknown as PulseBridgeCore;
}

function makeApp(opts: Partial<BuildAppOptions> = {}) {
  return buildApp({
    core: fakeCore(),
    sse: {} as SseManager,
    configPath: "test.config.json",
    serverRoot: "/tmp",
    coreVersion: "0.1.0",
    authGuard: passThroughAuth,
    onRestart: () => {},
    logger: noopLogger,
    ...opts,
  });
}

describe("GET /health", () => {
  it("should return the platform health status", async () => {
    const res = await makeApp().request("/health");
    expect(res.status).toBe(200);
  });

  it("should report the installed core version", async () => {
    const res = await makeApp({ coreVersion: "1.2.3" }).request("/health");
    const body = (await res.json()) as { version: string };
    expect(body.version).toBe("1.2.3");
  });
});

describe("GET /plugins", () => {
  it("should attach each plugin's manifest version", async () => {
    const core = fakeCore({
      listPluginStates: () =>
        [{ pluginId: "sonarr", status: "enabled" }] as never,
      listIntegrationManifests: () =>
        [{ id: "sonarr", version: "2.0.0" }] as never,
    });
    const res = await makeApp({ core }).request("/plugins");
    const body = (await res.json()) as Array<{
      pluginId: string;
      version?: string;
    }>;
    expect(body[0]?.version).toBe("2.0.0");
  });
});

describe("unknown routes", () => {
  it("should return 404 with the standard error shape", async () => {
    const res = await makeApp().request("/does-not-exist");
    const body = (await res.json()) as { error: { message: string } };
    expect(body).toEqual({ error: { message: "Not found." } });
  });
});

describe("error boundary", () => {
  it("should return a generic 500 when a handler throws", async () => {
    const core = fakeCore({
      getView: async () => {
        throw new Error("boom at /secret/internal/path");
      },
    });
    const res = await makeApp({ core }).request("/views/anything");
    expect(res.status).toBe(500);
  });

  it("should not leak the internal error message to the client", async () => {
    const core = fakeCore({
      getView: async () => {
        throw new Error("boom at /secret/internal/path");
      },
    });
    const res = await makeApp({ core }).request("/views/anything");
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Internal server error.");
  });
});

describe("POST /plugins/install package validation", () => {
  async function install(pkg: string): Promise<Response> {
    return makeApp().request("/plugins/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: pkg }),
    });
  }

  it("should reject a spec containing shell metacharacters", async () => {
    const res = await install("foo & calc");
    expect(res.status).toBe(400);
  });

  it("should reject a spec containing a command separator", async () => {
    const res = await install("foo;rm-rf");
    expect(res.status).toBe(400);
  });

  it("should reject a spec that looks like a CLI flag", async () => {
    const res = await install("--registry=http://evil");
    expect(res.status).toBe(400);
  });
});

describe("CORS", () => {
  it("should reflect an allowed origin when an allowlist is configured", async () => {
    const app = makeApp({ corsOrigins: ["https://dashboard.test"] });
    const res = await app.request("/health", {
      headers: { Origin: "https://dashboard.test" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://dashboard.test",
    );
  });

  it("should not reflect a disallowed origin when an allowlist is configured", async () => {
    const app = makeApp({ corsOrigins: ["https://dashboard.test"] });
    const res = await app.request("/health", {
      headers: { Origin: "https://evil.test" },
    });
    expect(res.headers.get("access-control-allow-origin")).not.toBe(
      "https://evil.test",
    );
  });

  it("should allow any origin when no allowlist is configured", async () => {
    const res = await makeApp().request("/health", {
      headers: { Origin: "https://anything.test" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

const manifestWithAction = {
  id: "sonarr",
  name: "Sonarr",
  version: "0.1.0",
  kind: "integration",
  operations: [],
  actions: [{ id: "search", name: "Search" }],
} as unknown as ReturnType<PulseBridgeCore["getIntegrationManifest"]>;

const manifestWithWebhook = {
  id: "sonarr",
  name: "Sonarr",
  version: "0.1.0",
  kind: "integration",
  operations: [],
  webhook: { description: "Sonarr events" },
} as unknown as ReturnType<PulseBridgeCore["getIntegrationManifest"]>;

describe("GET /plugins/:id/actions", () => {
  it("should return the declared actions for a registered plugin", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
    });
    const res = await makeApp({ core }).request("/plugins/sonarr/actions");
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body).toEqual([{ id: "search", name: "Search" }]);
  });

  it("should return 404 when the plugin is not registered", async () => {
    const core = fakeCore({ getIntegrationManifest: () => undefined });
    const res = await makeApp({ core }).request("/plugins/nope/actions");
    expect(res.status).toBe(404);
  });
});

describe("POST /plugins/:id/actions/:actionId", () => {
  it("should invoke the action and return its data", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
      invokeAction: async () => ({ data: { added: true } }),
    });
    const res = await makeApp({ core }).request(
      "/plugins/sonarr/actions/search",
      { method: "POST" },
    );
    const body = (await res.json()) as { data: unknown };
    expect(body).toEqual({ data: { added: true } });
  });

  it("should return 400 when a PluginInputError is thrown", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
      invokeAction: async () => {
        throw new PluginInputError("Missing seriesId.");
      },
    });
    const res = await makeApp({ core }).request(
      "/plugins/sonarr/actions/search",
      { method: "POST" },
    );
    const body = (await res.json()) as { error: { message: string } };
    expect(res.status).toBe(400);
    expect(body.error.message).toBe("Missing seriesId.");
  });

  it("should return 401 when the plugin throws an auth error", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
      invokeAction: async () => {
        throw new PluginAuthError("bad key");
      },
    });
    const res = await makeApp({ core }).request(
      "/plugins/sonarr/actions/search",
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("should return 429 when the upstream rate limits the request", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
      invokeAction: async () => {
        throw new RateLimitError("slow down");
      },
    });
    const res = await makeApp({ core }).request(
      "/plugins/sonarr/actions/search",
      { method: "POST" },
    );
    expect(res.status).toBe(429);
  });

  it("should return 400 when the request body is not valid JSON", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
      invokeAction: async () => ({ data: null }),
    });
    const res = await makeApp({ core }).request(
      "/plugins/sonarr/actions/search",
      { method: "POST", body: "{not json" },
    );
    expect(res.status).toBe(400);
  });

  it("should return 404 when the action is not declared", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
    });
    const res = await makeApp({ core }).request(
      "/plugins/sonarr/actions/unknown",
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /plugins/:id/webhook", () => {
  it("should ingest the webhook and return the plugin data", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithWebhook,
      ingest: async () => ({ data: { received: 1 } }),
    });
    const res = await makeApp({ core }).request("/plugins/sonarr/webhook", {
      method: "POST",
      body: JSON.stringify({ eventType: "Grab" }),
    });
    const body = (await res.json()) as { received: number };
    expect(body).toEqual({ received: 1 });
  });

  it("should return 404 when the plugin does not accept webhooks", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithAction,
    });
    const res = await makeApp({ core }).request("/plugins/sonarr/webhook", {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("should return 413 when the payload exceeds the size cap", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithWebhook,
      ingest: async () => ({ data: { ok: true } }),
    });
    const oversized = "x".repeat(1_048_577);
    const res = await makeApp({ core }).request("/plugins/sonarr/webhook", {
      method: "POST",
      body: oversized,
    });
    expect(res.status).toBe(413);
  });

  it("should return 502 when the plugin reports a transient upstream fault", async () => {
    const core = fakeCore({
      getIntegrationManifest: () => manifestWithWebhook,
      ingest: async () => {
        throw new TransientError("upstream down");
      },
    });
    const res = await makeApp({ core }).request("/plugins/sonarr/webhook", {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(502);
  });
});
