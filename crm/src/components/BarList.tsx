export function BarList({
  items,
}: {
  items: { label: string; value: number; display: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-text-muted">{item.label}</span>
            <span className="font-medium text-text">{item.display}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                boxShadow: "0 0 10px var(--accent-glow, rgba(91,141,239,.35))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
