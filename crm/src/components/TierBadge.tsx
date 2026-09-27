import type { ContactTier } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/domain";

export function TierBadge({ tier }: { tier: ContactTier }) {
  const isHighTicket = tier === "high_ticket";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        isHighTicket
          ? "border-tier-high/30 bg-tier-high/10 text-tier-high"
          : "border-tier-standard/30 bg-tier-standard/10 text-tier-standard"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isHighTicket ? "bg-tier-high shadow-[0_0_8px_var(--tier-high)]" : "bg-tier-standard"
        }`}
      />
      {TIER_LABELS[tier]}
    </span>
  );
}
