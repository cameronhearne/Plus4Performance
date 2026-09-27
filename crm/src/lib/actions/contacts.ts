"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { queueEmailsForStageChange } from "@/lib/actions/email";
import type { ContactSource, ContactStage, ContactTier } from "@/lib/domain";

export async function createContact(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const tier = String(formData.get("tier") ?? "standard") as ContactTier;
  const source = String(formData.get("source") ?? "organic") as ContactSource;
  const valueRaw = String(formData.get("value_gbp") ?? "").trim();
  const value_gbp = valueRaw ? Number(valueRaw) : null;

  const { data, error } = await supabase
    .from("contacts")
    .insert({ name, email, phone, tier, source, value_gbp })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/kanban");
  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(contactId: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const tier = String(formData.get("tier") ?? "standard") as ContactTier;
  const source = String(formData.get("source") ?? "organic") as ContactSource;
  const valueRaw = String(formData.get("value_gbp") ?? "").trim();
  const value_gbp = valueRaw ? Number(valueRaw) : null;

  const { error } = await supabase
    .from("contacts")
    .update({ name, email, phone, tier, source, value_gbp })
    .eq("id", contactId);

  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/kanban");
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Central stage-change path used by both the Kanban board (drag-and-drop)
 * and the contact detail page. Updates the contact, logs activity, and
 * queues any matching email sequences.
 */
export async function changeContactStage(
  contactId: string,
  newStage: ContactStage,
  options?: { lostReason?: string }
) {
  const supabase = await createClient();

  const { data: contact, error: fetchError } = await supabase
    .from("contacts")
    .select("stage, tier")
    .eq("id", contactId)
    .single();
  if (fetchError) throw fetchError;

  const previousStage = contact.stage;
  if (previousStage === newStage) return;

  const { error: updateError } = await supabase
    .from("contacts")
    .update({
      stage: newStage,
      lost_reason: newStage === "lost" ? options?.lostReason ?? null : null,
    })
    .eq("id", contactId);
  if (updateError) throw updateError;

  const { error: activityError } = await supabase.from("activity_log").insert({
    contact_id: contactId,
    type: "stage_change",
    content: `Stage changed from ${previousStage} to ${newStage}`,
  });
  if (activityError) throw activityError;

  await queueEmailsForStageChange(supabase, {
    contactId,
    tier: contact.tier,
    stage: newStage,
  });

  revalidatePath("/");
  revalidatePath("/kanban");
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

export async function addNote(contactId: string, formData: FormData) {
  const supabase = await createClient();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const { error } = await supabase.from("activity_log").insert({
    contact_id: contactId,
    type: "note",
    content,
  });
  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function addTask(contactId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;

  const { error } = await supabase.from("tasks").insert({
    contact_id: contactId,
    title,
    due_date,
  });
  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
}

export async function toggleTask(taskId: string, contactId: string, completed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ completed }).eq("id", taskId);
  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
}
