import type {
  PulseBridgeCore,
  PulseLogger,
  PulseViewRecord,
} from "pulsebridge";

import type { SseManager } from "./sseManager.js";
import type { RuleConfig } from "./configLoader.js";

type Predicate = (item: unknown) => boolean;
type Effect = (item: unknown, core: PulseBridgeCore) => Promise<void>;

export class RuleEngine {
  private readonly predicates = new Map<string, Predicate>();
  private readonly effects = new Map<string, Effect>();
  // NOTE: in-memory; resets on restart. At-least-once delivery handles re-fire
  // after a restart for items that are still present in the next view update.
  private readonly fired = new Map<string, Set<string>>();

  registerPredicate(id: string, predicate: Predicate): void {
    this.predicates.set(id, predicate);
  }

  registerEffect(id: string, effect: Effect): void {
    this.effects.set(id, effect);
  }

  attach(
    rules: readonly RuleConfig[],
    core: PulseBridgeCore,
    sse: SseManager,
    logger: PulseLogger,
  ): void {
    if (rules.length === 0) return;

    core.on("view:updated", (view: PulseViewRecord) => {
      void this.handleViewUpdate(view, rules, core, sse, logger);
    });
  }

  private async handleViewUpdate(
    view: PulseViewRecord,
    rules: readonly RuleConfig[],
    core: PulseBridgeCore,
    sse: SseManager,
    logger: PulseLogger,
  ): Promise<void> {
    const matchingRules = rules.filter((r) => r.on === view.view);
    if (matchingRules.length === 0) return;

    for (const rule of matchingRules) {
      const predicate = this.predicates.get(rule.when);
      const effect = this.effects.get(rule.do);

      if (predicate === undefined || effect === undefined) {
        logger.warn(
          "Rule references unregistered predicate or effect — skipping.",
          { ruleId: rule.id, when: rule.when, do: rule.do },
        );
        continue;
      }

      for (const item of view.items) {
        if (!predicate(item)) continue;

        const dedupeKey = resolveDedupeKey(rule, item);
        if (dedupeKey !== null && this.hasFired(rule.id, dedupeKey)) continue;

        try {
          await effect(item, core);
          if (dedupeKey !== null) {
            this.markFired(rule.id, dedupeKey);
          }
          sse.broadcast("rule:triggered", {
            ruleId: rule.id,
            viewId: view.view,
            triggeredAt: new Date().toISOString(),
          });
        } catch (cause) {
          logger.error("Rule effect failed — will retry on next view update.", {
            ruleId: rule.id,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    }
  }

  private hasFired(ruleId: string, key: string): boolean {
    return this.fired.get(ruleId)?.has(key) ?? false;
  }

  private markFired(ruleId: string, key: string): void {
    let keys = this.fired.get(ruleId);
    if (keys === undefined) {
      keys = new Set();
      this.fired.set(ruleId, keys);
    }
    keys.add(key);
  }
}

function resolveDedupeKey(rule: RuleConfig, item: unknown): string | null {
  if (rule.dedupeBy === undefined) return null;
  if (item === null || typeof item !== "object") return null;
  const value = (item as Record<string, unknown>)[rule.dedupeBy];
  if (value === null || value === undefined) return null;
  return String(value);
}
