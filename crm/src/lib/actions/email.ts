import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ContactStage, ContactTier } from "@/lib/domain";

/**
 * Queues pending email_sends for any active sequence matching the contact's
 * new stage + tier. Called whenever a contact's stage changes.
 */
export async function queueEmailsForStageChange(
  supabase: SupabaseClient<Database>,
  params: { contactId: string; tier: ContactTier; stage: ContactStage }
) {
  const { data: sequences, error } = await supabase
    .from("email_sequences")
    .select("id, delay_hours")
    .eq("trigger_stage", params.stage)
    .eq("tier", params.tier)
    .eq("active", true);

  if (error) throw error;
  if (!sequences || sequences.length === 0) return;

  const now = Date.now();
  const rows = sequences.map((sequence) => ({
    contact_id: params.contactId,
    sequence_id: sequence.id,
    status: "pending" as const,
    scheduled_for: new Date(now + sequence.delay_hours * 60 * 60 * 1000).toISOString(),
  }));

  const { error: insertError } = await supabase.from("email_sends").insert(rows);
  if (insertError) throw insertError;
}

/**
 * STUB — the only function that needs to change when Resend is wired in.
 * Does nothing but log; no provider is connected yet.
 */
export async function sendQueuedEmail(emailSendId: string) {
  console.log(`[sendQueuedEmail] would send email_send ${emailSendId} (provider not yet connected)`);
}
