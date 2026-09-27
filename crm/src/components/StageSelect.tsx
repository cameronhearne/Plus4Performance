"use client";

import { useState, useTransition } from "react";
import { STAGES, STAGE_LABELS, type ContactStage } from "@/lib/domain";
import { changeContactStage } from "@/lib/actions/contacts";

export function StageSelect({
  contactId,
  currentStage,
}: {
  contactId: string;
  currentStage: ContactStage;
}) {
  const [stage, setStage] = useState(currentStage);
  const [pending, startTransition] = useTransition();
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");

  function apply(newStage: ContactStage, reason?: string) {
    const previous = stage;
    setStage(newStage);
    startTransition(async () => {
      try {
        await changeContactStage(contactId, newStage, { lostReason: reason });
      } catch {
        setStage(previous);
      }
    });
  }

  function handleChange(newStage: ContactStage) {
    if (newStage === "lost") {
      setShowLostReason(true);
      return;
    }
    apply(newStage);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={stage}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value as ContactStage)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none transition focus:border-border-strong disabled:opacity-50"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>

      {showLostReason && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Reason for loss"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-border-strong"
          />
          <button
            onClick={() => {
              setShowLostReason(false);
              apply("lost", lostReason);
            }}
            className="rounded-lg bg-accent-base px-3 py-1.5 text-sm text-white hover:bg-accent"
          >
            Confirm
          </button>
          <button
            onClick={() => setShowLostReason(false)}
            className="text-sm text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
