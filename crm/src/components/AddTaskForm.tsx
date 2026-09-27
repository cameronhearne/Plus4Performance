"use client";

import { useRef, useTransition } from "react";
import { addTask } from "@/lib/actions/contacts";

export function AddTaskForm({ contactId }: { contactId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData: FormData) => {
        startTransition(async () => {
          await addTask(contactId, formData);
          formRef.current?.reset();
        });
      }}
      className="flex gap-2"
    >
      <input
        name="title"
        placeholder="Task title…"
        required
        className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent"
      />
      <input
        name="due_date"
        type="date"
        className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none transition focus:border-border-strong"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium text-text transition hover:bg-accent-base disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
