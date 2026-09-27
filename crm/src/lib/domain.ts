import type { Enums } from "@/types/database";

export type ContactStage = Enums<"contact_stage">;
export type ContactTier = Enums<"contact_tier">;
export type ContactSource = Enums<"contact_source">;
export type ActivityType = Enums<"activity_type">;
export type EmailSendStatus = Enums<"email_send_status">;

export const STAGES: ContactStage[] = [
  "lead",
  "contacted",
  "call_booked",
  "call_done",
  "proposal_sent",
  "won",
  "lost",
];

export const STAGE_LABELS: Record<ContactStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  call_booked: "Call Booked",
  call_done: "Call Done",
  proposal_sent: "Proposal Sent",
  won: "Won",
  lost: "Lost",
};

// Kanban only shows the active pipeline — won/lost contacts are archived off the board.
export const KANBAN_STAGES: ContactStage[] = [
  "lead",
  "contacted",
  "call_booked",
  "call_done",
  "proposal_sent",
  "won",
];

export const TIER_LABELS: Record<ContactTier, string> = {
  high_ticket: "High Ticket",
  standard: "Standard",
};

export const SOURCE_LABELS: Record<ContactSource, string> = {
  organic: "Organic",
  referral: "Referral",
  paid: "Paid",
  dm: "DM",
  other: "Other",
};

export const SOURCES: ContactSource[] = ["organic", "referral", "paid", "dm", "other"];
export const TIERS: ContactTier[] = ["high_ticket", "standard"];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: "Note",
  email: "Email",
  call: "Call",
  stage_change: "Stage Change",
};

export function formatGBP(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
