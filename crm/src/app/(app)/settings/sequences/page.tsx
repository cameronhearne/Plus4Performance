import { getEmailSequences } from "@/lib/queries";
import { SequenceCard } from "@/components/SequenceCard";

export default async function SequencesSettingsPage() {
  const sequences = await getEmailSequences();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text">Email Sequences</h1>
        <p className="mt-1 text-sm text-text-muted">
          Automated follow-ups triggered by stage changes. Sending is not yet connected —
          triggered emails are queued in the dashboard for review.
        </p>
      </header>

      <div className="space-y-3">
        {sequences.map((sequence) => (
          <SequenceCard key={sequence.id} sequence={sequence} />
        ))}
      </div>
    </div>
  );
}
