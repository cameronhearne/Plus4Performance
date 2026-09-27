"use client";

import { useRef, useTransition } from "react";
import { addNote } from "@/lib/actions/contacts";

export function AddNoteForm({ contactId }: { contactId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData: FormData) => {
        startTransition(async () => {
          await addNote(contactId, formData);
          formRef.current?.reset();
        });
      }}
      className="flex gap-2"
    >
      <input
        name="content"
        placeholder="Add a note…"
        required
        className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent"
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
