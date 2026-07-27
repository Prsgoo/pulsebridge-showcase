import type {
  HealthInfo,
  PluginInfo,
  RecordTypeCount,
  ViewSnapshot,
} from "./types.ts";

export class PulseBridgeClient {
  constructor(private readonly baseUrl: string) {}

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  getHealth(): Promise<HealthInfo> {
    return this.getJson<HealthInfo>("/health");
  }

  getPlugins(): Promise<PluginInfo[]> {
    return this.getJson<PluginInfo[]>("/plugins");
  }

  async getViews(): Promise<ViewSnapshot[]> {
    const ids = await this.getJson<string[]>("/views");
    return Promise.all(
      ids.map((id) => this.getJson<ViewSnapshot>(`/views/${id}`)),
    );
  }

  async getRecordCounts(): Promise<RecordTypeCount[]> {
    const types = await this.getJson<string[]>("/records");
    return Promise.all(
      types.map(async (type) => {
        const records = await this.getJson<unknown[]>(
          `/records/${encodeURIComponent(type)}`,
        );
        return { type, count: records.length };
      }),
    );
  }

  getRecords(type: string): Promise<unknown[]> {
    return this.getJson<unknown[]>(`/records/${encodeURIComponent(type)}`);
  }

  openEvents(): EventSource {
    return new EventSource(`${this.baseUrl}/events`);
  }
}
