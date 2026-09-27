import "server-only";
import { createClient } from "@/lib/supabase/server";
import { KANBAN_STAGES, STAGES, type ContactStage } from "@/lib/domain";
import type { Tables } from "@/types/database";

export type Contact = Tables<"contacts">;
export type ActivityLogRow = Tables<"activity_log">;
export type TaskRow = Tables<"tasks">;
export type EmailSequenceRow = Tables<"email_sequences">;
export type EmailSendRow = Tables<"email_sends">;

export async function getContactsForKanban() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .in("stage", KANBAN_STAGES)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const byStage = new Map<ContactStage, Contact[]>(KANBAN_STAGES.map((s) => [s, []]));
  for (const contact of data ?? []) {
    byStage.get(contact.stage)?.push(contact);
  }
  return byStage;
}

export async function getAllContacts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getContact(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function getActivityForContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTasksForContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("contact_id", contactId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDashboardData() {
  const supabase = await createClient();

  const { data: contacts, error } = await supabase.from("contacts").select("*");
  if (error) throw error;
  const all = contacts ?? [];

  const pipelineByStage = STAGES.map((stage) => ({
    stage,
    value: all
      .filter((c) => c.stage === stage)
      .reduce((sum, c) => sum + (c.value_gbp ?? 0), 0),
  }));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const wonThisMonth = all.filter(
    (c) => c.stage === "won" && new Date(c.updated_at) >= monthStart
  );
  const wonThisMonthValue = wonThisMonth.reduce((sum, c) => sum + (c.value_gbp ?? 0), 0);

  const sourceGroups = new Map<string, { total: number; won: number }>();
  for (const c of all) {
    const g = sourceGroups.get(c.source) ?? { total: 0, won: 0 };
    g.total += 1;
    if (c.stage === "won") g.won += 1;
    sourceGroups.set(c.source, g);
  }
  const conversionBySource = Array.from(sourceGroups.entries()).map(([source, g]) => ({
    source,
    rate: g.total > 0 ? (g.won / g.total) * 100 : 0,
    total: g.total,
  }));

  const activeLeads = all.filter((c) => c.stage !== "won" && c.stage !== "lost").length;

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*, contact:contacts(id, name)")
    .eq("completed", false)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });
  if (tasksError) throw tasksError;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueTasks = (tasks ?? []).filter((t) => t.due_date && new Date(t.due_date) <= today);

  const { count: pendingEmailCount } = await supabase
    .from("email_sends")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { data: pendingEmails } = await supabase
    .from("email_sends")
    .select("*, contact:contacts(id, name), sequence:email_sequences(id, name, subject)")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(10);

  return {
    pipelineByStage,
    wonThisMonthValue,
    wonThisMonthCount: wonThisMonth.length,
    conversionBySource,
    activeLeads,
    dueTasks,
    pendingEmailCount: pendingEmailCount ?? 0,
    pendingEmails: pendingEmails ?? [],
  };
}

export async function getEmailSequences() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_sequences")
    .select("*")
    .order("trigger_stage", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
