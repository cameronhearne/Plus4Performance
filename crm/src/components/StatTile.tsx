export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-text">{value}</div>
      {sub && <div className="mt-1 text-xs text-text-faint">{sub}</div>}
    </div>
  );
}
