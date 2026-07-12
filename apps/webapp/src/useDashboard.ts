import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PulseBridgeClient } from "./api.ts";
import type {
  ConnectionState,
  PluginInfo,
  RecordTypeCount,
  ViewSnapshot,
} from "./types.ts";

const REFRESH_MS = 15_000;

export interface DashboardState {
  plugins: PluginInfo[];
  views: ViewSnapshot[];
  records: RecordTypeCount[];
  coreVersion: string | null;
  connection: ConnectionState;
  reachable: boolean;
}

export function useDashboard(baseUrl: string): DashboardState {
  const client = useMemo(() => new PulseBridgeClient(baseUrl), [baseUrl]);

  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [views, setViews] = useState<ViewSnapshot[]>([]);
  const [records, setRecords] = useState<RecordTypeCount[]>([]);
  const [coreVersion, setCoreVersion] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [reachable, setReachable] = useState(true);

  const refreshPlugins = useCallback(async () => {
    try {
      setPlugins(await client.getPlugins());
      setReachable(true);
    } catch {
      setReachable(false);
    }
  }, [client]);

  // The core version only changes across restarts, so fetch it once per client.
  const refreshHealth = useCallback(async () => {
    try {
      setCoreVersion((await client.getHealth()).version);
    } catch {
      /* leave previous version in place */
    }
  }, [client]);

  const refreshViews = useCallback(async () => {
    try {
      setViews(await client.getViews());
    } catch {
      /* leave previous snapshot in place */
    }
  }, [client]);

  const refreshRecords = useCallback(async () => {
    try {
      setRecords(await client.getRecordCounts());
    } catch {
      /* leave previous counts in place */
    }
  }, [client]);

  const refreshAll = useCallback(() => {
    void refreshHealth();
    void refreshPlugins();
    void refreshViews();
    void refreshRecords();
  }, [refreshHealth, refreshPlugins, refreshViews, refreshRecords]);

  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;

  useEffect(() => {
    refreshAll();
    const timer = setInterval(() => refreshAllRef.current(), REFRESH_MS);

    const source = client.openEvents();
    source.addEventListener("connected", () => setConnection("live"));
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("down");
    source.addEventListener("view:updated", () => {
      void refreshViews();
      void refreshRecords();
    });
    source.addEventListener("plugin:status-changed", () => {
      void refreshPlugins();
    });

    return () => {
      clearInterval(timer);
      source.close();
    };
  }, [client, refreshAll, refreshPlugins, refreshViews, refreshRecords]);

  return { plugins, views, records, coreVersion, connection, reachable };
}
