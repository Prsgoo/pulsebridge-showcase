import { useEffect, useMemo, useState } from "react";

import { PulseBridgeClient } from "./api.ts";
import type { PulseRecord } from "./types.ts";
import { isPulseRecord } from "./types.ts";

const REFRESH_MS = 15_000;

export function useRecords<T>(
  baseUrl: string,
  type: string,
): ReadonlyArray<PulseRecord<T>> {
  const client = useMemo(() => new PulseBridgeClient(baseUrl), [baseUrl]);
  const [records, setRecords] = useState<ReadonlyArray<PulseRecord<T>>>([]);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      client
        .getRecords(type)
        .then((items) => {
          if (!cancelled) {
            setRecords(items.filter(isPulseRecord) as PulseRecord<T>[]);
          }
        })
        .catch(() => {
          /* leave previous records in place */
        });
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [client, type]);

  return records;
}
