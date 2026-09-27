"use client";

import { useState, useTransition } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Contact } from "@/lib/queries";
import { KANBAN_STAGES, STAGE_LABELS, type ContactStage } from "@/lib/domain";
import { KanbanColumn } from "@/components/KanbanColumn";
import { changeContactStage } from "@/lib/actions/contacts";

export function KanbanBoard({
  initialColumns,
}: {
  initialColumns: Record<ContactStage, Contact[]>;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const contactId = String(active.id);
    const newStage = over.id as ContactStage;

    let previousColumns = columns;
    let sourceStage: ContactStage | null = null;
    let contact: Contact | null = null;

    for (const stage of KANBAN_STAGES) {
      const found = columns[stage].find((c) => c.id === contactId);
      if (found) {
        sourceStage = stage;
        contact = found;
        break;
      }
    }
    if (!contact || !sourceStage || sourceStage === newStage) return;

    previousColumns = columns;
    setColumns((prev) => ({
      ...prev,
      [sourceStage as ContactStage]: prev[sourceStage as ContactStage].filter(
        (c) => c.id !== contactId
      ),
      [newStage]: [{ ...contact!, stage: newStage }, ...prev[newStage]],
    }));

    startTransition(async () => {
      try {
        await changeContactStage(contactId, newStage);
      } catch {
        setColumns(previousColumns);
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            label={STAGE_LABELS[stage]}
            contacts={columns[stage]}
          />
        ))}
      </div>
    </DndContext>
  );
}
