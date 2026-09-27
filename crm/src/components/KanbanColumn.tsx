"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Contact } from "@/lib/queries";
import { KanbanCard } from "@/components/KanbanCard";
import { formatGBP } from "@/lib/domain";
import type { ContactStage } from "@/lib/domain";

export function KanbanColumn({
  stage,
  label,
  contacts,
}: {
  stage: ContactStage;
  label: string;
  contacts: Contact[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalValue = contacts.reduce((sum, c) => sum + (c.value_gbp ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 transition ${
        isOver ? "border-border-strong bg-surface-2" : "border-border bg-surface"
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-medium text-text">{label}</h3>
          <p className="text-xs text-text-faint">{formatGBP(totalValue)}</p>
        </div>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
          {contacts.length}
        </span>
      </div>
      <div className="min-h-[80px] flex-1 space-y-2 overflow-y-auto">
        {contacts.map((contact) => (
          <KanbanCard key={contact.id} contact={contact} />
        ))}
      </div>
    </div>
  );
}
