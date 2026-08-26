import type { NewsFeedItem } from "../types.ts";
import { formatRelativeTime } from "../lib/format.ts";

interface NewsFeedPanelProps {
  items: NewsFeedItem[];
}

export function NewsFeedPanel({ items }: NewsFeedPanelProps) {
  return (
    <div className="max-h-[480px] overflow-auto rounded-xl border border-edge">
      {items.map((item, index) => (
        <NewsRow key={item.id} item={item} divider={index > 0} />
      ))}
    </div>
  );
}

function NewsRow({ item, divider }: { item: NewsFeedItem; divider: boolean }) {
  return (
    <div
      className={`px-4 py-3 ${divider ? "border-t border-edge" : ""} bg-panel hover:bg-panel-2`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 text-sm font-medium text-ink hover:text-blue-400 hover:underline"
        >
          {item.title}
        </a>
        <span className="shrink-0 text-xs text-muted">
          {formatRelativeTime(item.seenDate)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="rounded border border-edge bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
          {item.domain}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {item.sourceCountry}
        </span>
        {item.source && (
          <span className="text-[10px] text-muted">{item.source}</span>
        )}
      </div>
      {item.summary && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
          {item.summary}
        </p>
      )}
    </div>
  );
}
