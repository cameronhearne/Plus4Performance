"use client";

import { useState, useTransition } from "react";
import type { TaskRow } from "@/lib/queries";
import { toggleTask } from "@/lib/actions/contacts";
import { formatDate } from "@/lib/domain";

export function TaskList({ contactId, tasks }: { contactId: string; tasks: TaskRow[] }) {
  const [items, setItems] = useState(tasks);
  const [, startTransition] = useTransition();

  function handleToggle(taskId: string, completed: boolean) {
    setItems((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed } : t)));
    startTransition(async () => {
      try {
        await toggleTask(taskId, contactId, completed);
      } catch {
        setItems((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: !completed } : t)));
      }
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-text-faint">No tasks yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((task) => (
        <li
          key={task.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2"
        >
          <input
            type="checkbox"
            checked={task.completed}
            onChange={(e) => handleToggle(task.id, e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span
            className={`flex-1 text-sm ${
              task.completed ? "text-text-faint line-through" : "text-text"
            }`}
          >
            {task.title}
          </span>
          {task.due_date && (
            <span className="text-xs text-text-faint">{formatDate(task.due_date)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
