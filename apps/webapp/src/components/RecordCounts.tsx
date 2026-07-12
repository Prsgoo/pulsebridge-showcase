import { useEffect, useState } from "react";

import type { RecordTypeCount } from "../types.ts";
import { isPulseRecord } from "../types.ts";
import { RecordCard } from "./records/RecordCard.tsx";

const DETAIL_LIMIT = 12;

interface RecordCountsProps {
  records: RecordTypeCount[];
  onSelect: (type: string) => Promise<unknown[]>;
}

export function RecordCounts({ records, onSelect }: RecordCountsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown[]>([]);

  // Re-fetch the open detail whenever the data refreshes (the `records` prop
  // changes identity on every poll / SSE update), so its timestamps stay live.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    onSelect(selected)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) setDetail([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, records, onSelect]);

  if (records.length === 0) {
    return <p className="text-muted italic">No record types yet.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {records.map(({ type, count }) => (
          <button
            key={type}
            onClick={() => setSelected(type)}
            className={`flex cursor-pointer items-center justify-between rounded-xl border bg-panel p-4 text-left ${
              selected === type ? "border-blue-600" : "border-edge"
            }`}
          >
            <span className="font-mono text-xs">{type}</span>
            <span className="tabular-nums text-blue-400">{count}</span>
          </button>
        ))}
      </div>

      {selected && <RecordDetail items={detail} />}
    </div>
  );
}

function RecordDetail({ items }: { items: unknown[] }) {
  const records = items.filter(isPulseRecord).slice(0, DETAIL_LIMIT);

  if (records.length === 0) {
    return <p className="mt-3 text-muted italic">No records yet.</p>;
  }

  return (
    <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
      {records.map((record) => (
        <RecordCard key={record.entityKey} record={record} />
      ))}
    </div>
  );
}
