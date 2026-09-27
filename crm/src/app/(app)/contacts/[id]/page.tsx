import { notFound } from "next/navigation";
import {
  getContact,
  getActivityForContact,
  getTasksForContact,
} from "@/lib/queries";
import { updateContact } from "@/lib/actions/contacts";
import { ContactForm } from "@/components/ContactForm";
import { StageSelect } from "@/components/StageSelect";
import { TierBadge } from "@/components/TierBadge";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AddNoteForm } from "@/components/AddNoteForm";
import { AddTaskForm } from "@/components/AddTaskForm";
import { TaskList } from "@/components/TaskList";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let contact;
  try {
    contact = await getContact(id);
  } catch {
    notFound();
  }
  if (!contact) notFound();

  const [activity, tasks] = await Promise.all([
    getActivityForContact(id),
    getTasksForContact(id),
  ]);

  const boundUpdate = updateContact.bind(null, id);

  return (
    <div className="max-w-4xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2">
            <TierBadge tier={contact.tier} />
          </div>
          <h1 className="text-xl font-semibold text-text">{contact.name}</h1>
          {contact.lost_reason && (
            <p className="mt-1 text-sm text-danger">Lost: {contact.lost_reason}</p>
          )}
        </div>
        <StageSelect contactId={contact.id} currentStage={contact.stage} />
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-text">Details</h2>
          <ContactForm action={boundUpdate} contact={contact} submitLabel="Save Changes" />
        </section>

        <section className="space-y-8 lg:col-span-3">
          <div>
            <h2 className="mb-3 text-sm font-medium text-text">Tasks</h2>
            <div className="mb-3">
              <AddTaskForm contactId={contact.id} />
            </div>
            <TaskList contactId={contact.id} tasks={tasks} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-text">Activity</h2>
            <div className="mb-4">
              <AddNoteForm contactId={contact.id} />
            </div>
            <ActivityTimeline activity={activity} />
          </div>
        </section>
      </div>
    </div>
  );
}
