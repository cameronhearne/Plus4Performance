import Link from "next/link";
import { getContactsForKanban, type Contact } from "@/lib/queries";
import { KANBAN_STAGES, type ContactStage } from "@/lib/domain";
import { KanbanBoard } from "@/components/KanbanBoard";

export default async function KanbanPage() {
  const byStage = await getContactsForKanban();
  const columns = Object.fromEntries(
    KANBAN_STAGES.map((stage) => [stage, byStage.get(stage) ?? []])
  ) as Record<ContactStage, Contact[]>;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Pipeline</h1>
          <p className="mt-1 text-sm text-text-muted">Drag cards to change stage.</p>
        </div>
        <Link
          href="/contacts/new"
          className="rounded-lg bg-accent-base px-4 py-2 text-sm font-medium text-white transition hover:bg-accent"
        >
          Add Contact
        </Link>
      </header>

      <KanbanBoard initialColumns={columns} />
    </div>
  );
}
