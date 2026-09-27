import type { ActivityLogRow } from "@/lib/queries";
import { ACTIVITY_LABELS, formatDateTime } from "@/lib/domain";

export function ActivityTimeline({ activity }: { activity: ActivityLogRow[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-text-faint">No activity yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {activity.map((item) => (
        <li key={item.id} className="flex gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-text-faint">
              <span className="font-medium text-text-muted">
                {ACTIVITY_LABELS[item.type]}
              </span>
              <span>·</span>
              <span>{formatDateTime(item.created_at)}</span>
            </div>
            {item.content && <p className="mt-0.5 text-sm text-text">{item.content}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
