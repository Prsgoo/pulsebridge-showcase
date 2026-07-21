import { describe, it, expect, vi } from "vitest";

import type {
  PulseBridgeCore,
  PulseLogger,
  PulseViewRecord,
} from "pulsebridge";

import type { SseManager } from "./sseManager.js";
import type { RuleConfig } from "./configLoader.js";
import { RuleEngine } from "./ruleEngine.js";

function makeTestEnv() {
  const viewListeners: Array<(view: PulseViewRecord) => void> = [];

  const core = {
    on: vi.fn((_event: string, listener: (view: PulseViewRecord) => void) => {
      viewListeners.push(listener);
    }),
    invokeAction: vi.fn().mockResolvedValue({ data: null }),
  } as unknown as PulseBridgeCore;

  const sseBroadcast = vi.fn();
  const sse = { broadcast: sseBroadcast } as unknown as SseManager;

  const logger: PulseLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  // Emits a view event and waits for all async effects to settle.
  const emitView = async (view: PulseViewRecord): Promise<void> => {
    for (const listener of viewListeners) {
      listener(view);
    }
    await new Promise<void>((r) => setTimeout(r, 0));
  };

  return { core, sse, logger, emitView, sseBroadcast };
}

const baseView = (items: unknown[]): PulseViewRecord => ({
  view: "my-view",
  generatedAt: "2025-01-01T00:00:00Z",
  items,
});

const baseRule = (overrides: Partial<RuleConfig> = {}): RuleConfig => ({
  id: "r1",
  on: "my-view",
  when: "always",
  do: "notify",
  ...overrides,
});

describe("RuleEngine", () => {
  it("should fire the effect when the predicate matches", async () => {
    const { core, sse, logger, emitView } = makeTestEnv();
    const engine = new RuleEngine();
    const effect = vi.fn().mockResolvedValue(undefined);

    engine.registerPredicate("always", () => true);
    engine.registerEffect("notify", effect);
    engine.attach([baseRule()], core, sse, logger);

    const item = { id: "e1" };
    await emitView(baseView([item]));

    expect(effect).toHaveBeenCalledWith(item, core);
  });

  it("should not fire when the predicate returns false", async () => {
    const { core, sse, logger, emitView } = makeTestEnv();
    const engine = new RuleEngine();
    const effect = vi.fn().mockResolvedValue(undefined);

    engine.registerPredicate("never", () => false);
    engine.registerEffect("notify", effect);
    engine.attach([baseRule({ when: "never" })], core, sse, logger);

    await emitView(baseView([{ id: "e1" }]));

    expect(effect).not.toHaveBeenCalled();
  });

  it("should not fire when the view id does not match the rule", async () => {
    const { core, sse, logger, emitView } = makeTestEnv();
    const engine = new RuleEngine();
    const effect = vi.fn().mockResolvedValue(undefined);

    engine.registerPredicate("always", () => true);
    engine.registerEffect("notify", effect);
    engine.attach([baseRule({ on: "other-view" })], core, sse, logger);

    await emitView(baseView([{ id: "e1" }]));

    expect(effect).not.toHaveBeenCalled();
  });

  it("should fire only once per dedupeBy key across multiple view updates", async () => {
    const { core, sse, logger, emitView } = makeTestEnv();
    const engine = new RuleEngine();
    const effect = vi.fn().mockResolvedValue(undefined);

    engine.registerPredicate("always", () => true);
    engine.registerEffect("notify", effect);
    engine.attach([baseRule({ dedupeBy: "id" })], core, sse, logger);

    const view = baseView([{ id: "e1" }]);
    await emitView(view);
    await emitView(view);

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("should fire for each unique dedupeBy key independently", async () => {
    const { core, sse, logger, emitView } = makeTestEnv();
    const engine = new RuleEngine();
    const effect = vi.fn().mockResolvedValue(undefined);

    engine.registerPredicate("always", () => true);
    engine.registerEffect("notify", effect);
    engine.attach([baseRule({ dedupeBy: "id" })], core, sse, logger);

    await emitView(baseView([{ id: "e1" }, { id: "e2" }]));

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("should not mark an item as fired when the effect throws", async () => {
    const { core, sse, logger, emitView } = makeTestEnv();
    const engine = new RuleEngine();
    const effect = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue(undefined);

    engine.registerPredicate("always", () => true);
    engine.registerEffect("notify", effect);
    engine.attach([baseRule({ dedupeBy: "id" })], core, sse, logger);

    const view = baseView([{ id: "e1" }]);
    await emitView(view); // effect throws — item not marked
    await emitView(view); // retries and succeeds

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("should broadcast rule:triggered via SSE after a successful effect", async () => {
    const { core, sse, logger, emitView, sseBroadcast } = makeTestEnv();
    const engine = new RuleEngine();

    engine.registerPredicate("always", () => true);
    engine.registerEffect("notify", vi.fn().mockResolvedValue(undefined));
    engine.attach([baseRule()], core, sse, logger);

    await emitView(baseView([{ id: "e1" }]));

    expect(sseBroadcast).toHaveBeenCalledWith(
      "rule:triggered",
      expect.objectContaining({ ruleId: "r1", viewId: "my-view" }),
    );
  });

  it("should not broadcast rule:triggered when the effect throws", async () => {
    const { core, sse, logger, emitView, sseBroadcast } = makeTestEnv();
    const engine = new RuleEngine();

    engine.registerPredicate("always", () => true);
    engine.registerEffect(
      "notify",
      vi.fn().mockRejectedValue(new Error("fail")),
    );
    engine.attach([baseRule()], core, sse, logger);

    await emitView(baseView([{ id: "e1" }]));

    expect(sseBroadcast).not.toHaveBeenCalled();
  });

  it("should warn when a rule references an unregistered predicate", async () => {
    const { core, sse, logger, emitView } = makeTestEnv();
    const engine = new RuleEngine();

    engine.registerEffect("notify", vi.fn().mockResolvedValue(undefined));
    engine.attach([baseRule({ when: "unknown-predicate" })], core, sse, logger);

    await emitView(baseView([{ id: "e1" }]));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("unregistered"),
      expect.objectContaining({ ruleId: "r1" }),
    );
  });

  it("should not subscribe to core when there are no rules", () => {
    const { core, sse, logger } = makeTestEnv();
    const engine = new RuleEngine();

    engine.attach([], core, sse, logger);

    expect(core.on).not.toHaveBeenCalled();
  });
});
