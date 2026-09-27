"use client";

import { useState, useTransition } from "react";
import type { EmailSequenceRow } from "@/lib/queries";
import { STAGE_LABELS, TIER_LABELS } from "@/lib/domain";
import { toggleSequenceActive, updateSequence } from "@/lib/actions/sequences";

export function SequenceCard({ sequence }: { sequence: EmailSequenceRow }) {
  const [active, setActive] = useState(sequence.active);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      try {
        await toggleSequenceActive(sequence.id, next);
      } catch {
        setActive(!next);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-text">{sequence.name}</h3>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted">
              {TIER_LABELS[sequence.tier]}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-faint">
            Triggers on <span className="text-text-muted">{STAGE_LABELS[sequence.trigger_stage]}</span>{" "}
            + {sequence.delay_hours}h delay
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-text-muted hover:text-accent"
          >
            {expanded ? "Close" : "Edit"}
          </button>
          <button
            role="switch"
            aria-checked={active}
            disabled={pending}
            onClick={handleToggle}
            className={`relative h-5 w-9 rounded-full transition ${
              active ? "bg-accent-base" : "bg-surface-2"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                active ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <form
          action={(formData) => updateSequence(sequence.id, formData)}
          className="mt-4 space-y-3 border-t border-border pt-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Name</label>
            <input
              name="name"
              defaultValue={sequence.name}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Delay (hours)
            </label>
            <input
              name="delay_hours"
              type="number"
              min="0"
              defaultValue={sequence.delay_hours}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Subject</label>
            <input
              name="subject"
              defaultValue={sequence.subject}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Body</label>
            <textarea
              name="body_template"
              rows={3}
              defaultValue={sequence.body_template}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-accent-base px-4 py-2 text-sm font-medium text-white hover:bg-accent"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}
