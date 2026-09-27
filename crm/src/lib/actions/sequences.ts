"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleSequenceActive(sequenceId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_sequences")
    .update({ active })
    .eq("id", sequenceId);
  if (error) throw error;

  revalidatePath("/settings/sequences");
}

export async function updateSequence(sequenceId: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const delay_hours = Number(formData.get("delay_hours") ?? 0);
  const subject = String(formData.get("subject") ?? "").trim();
  const body_template = String(formData.get("body_template") ?? "").trim();

  const { error } = await supabase
    .from("email_sequences")
    .update({ name, delay_hours, subject, body_template })
    .eq("id", sequenceId);
  if (error) throw error;

  revalidatePath("/settings/sequences");
}
