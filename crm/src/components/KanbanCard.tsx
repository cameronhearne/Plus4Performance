"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import type { Contact } from "@/lib/queries";
import { TierBadge } from "@/components/TierBadge";
import { formatGBP } from "@/lib/domain";

export function KanbanCard({ contact }: { contact: Contact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group rounded-lg border border-border bg-bg-elevated p-3 transition ${
        isDragging ? "z-10 opacity-50" : "hover:border-border-strong"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/contacts/${contact.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-text hover:text-accent"
        >
          {contact.name}
        </Link>
      </div>
      <div className="mb-2">
        <TierBadge tier={contact.tier} />
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{formatGBP(contact.value_gbp)}</span>
      </div>
    </div>
  );
}
