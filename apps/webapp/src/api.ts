import type {
  HealthInfo,
  PluginInfo,
  ProvisioningSpec,
  RecordTypeCount,
  UpdateInfo,
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
      ids.map((id) => this.getJson<ViewSnapshot>(`/views/${id}?limit=200`)),
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

  private async fetchAuthed<T>(
    method: string,
    path: string,
    apiKey: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { "X-Api-Key": apiKey };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(data?.error?.message ?? `${path} → ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  getPluginSecrets(id: string, apiKey: string): Promise<ProvisioningSpec> {
    return this.fetchAuthed<ProvisioningSpec>(
      "GET",
      `/plugins/${encodeURIComponent(id)}/secrets`,
      apiKey,
    );
  }

  setPluginSecrets(
    id: string,
    values: Record<string, string>,
    apiKey: string,
  ): Promise<ProvisioningSpec> {
    return this.fetchAuthed<ProvisioningSpec>(
      "PUT",
      `/plugins/${encodeURIComponent(id)}/secrets`,
      apiKey,
      { values },
    );
  }

  getPluginUpdates(apiKey: string): Promise<UpdateInfo[]> {
    return this.fetchAuthed<UpdateInfo[]>("GET", "/plugins/updates", apiKey);
  }

  installPlugin(pkg: string, apiKey: string): Promise<unknown> {
    return this.fetchAuthed("POST", "/plugins/install", apiKey, {
      package: pkg,
    });
  }

  uninstallPlugin(pkg: string, apiKey: string): Promise<unknown> {
    return this.fetchAuthed("DELETE", "/plugins", apiKey, { package: pkg });
  }

  restartServer(apiKey: string): Promise<{ message: string }> {
    return this.fetchAuthed<{ message: string }>("POST", "/restart", apiKey);
  }
}
