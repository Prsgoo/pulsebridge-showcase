import type { PulseBridgeCore, PulseViewRecord } from "pulsebridge";

type SseSender = (event: string, data: unknown) => Promise<void>;

/**
 * Manages connected SSE clients and broadcasts events to all of them.
 *
 * Attaches to PulseBridgeCore events rather than polling — views are
 * broadcast the instant a processor writes them (zero delay), and plugin
 * status changes are forwarded automatically.
 */
export class SseManager {
  private readonly clients = new Set<SseSender>();

  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Registers a new SSE client. Returns an unsubscribe function that the
   * caller must invoke when the connection closes.
   */
  subscribe(sender: SseSender): () => void {
    this.clients.add(sender);
    return () => {
      this.clients.delete(sender);
    };
  }

  broadcast(event: string, data: unknown): void {
    for (const sender of this.clients) {
      sender(event, data).catch(() => {
        // Remove dead client on write failure.
        this.clients.delete(sender);
      });
    }
  }

  /**
   * Subscribes to core events and forwards them to all connected SSE clients.
   * Call once after the core has started.
   */
  attachToCore(core: PulseBridgeCore): void {
    core.on("view:updated", (view: PulseViewRecord) => {
      this.broadcast("view:updated", {
        viewId: view.view,
        generatedAt: view.generatedAt,
        items: view.items,
      });
    });

    core.on("plugin:status-changed", (event) => {
      this.broadcast("plugin:status-changed", event);
    });
  }
}
