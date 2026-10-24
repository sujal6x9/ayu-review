import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Paper = Database["public"]["Tables"]["papers"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type Activity = Database["public"]["Tables"]["activity"]["Row"];
export type PaperStatus = Database["public"]["Enums"]["paper_status"];
export type MarkStatus = Database["public"]["Enums"]["mark_status"];

export type PdfAnchor = { type: "pdf"; page: number; x: number; y: number; w: number; h: number; points?: { x: number; y: number }[]; tool?: "pen" };
export type CellAnchor = { type: "cell"; sheet: string; cell: string; row: number; col: number; tool?: "pen" };
export type Anchor = PdfAnchor | CellAnchor | { type: "general" };

export const STATUS_LABEL: Record<PaperStatus, string> = {
  draft: "Draft",
  uploaded: "Uploaded",
  assigned: "Assigned for Review",
  under_review: "Under Review",
  changes_requested: "Changes Requested",
  corrections_in_progress: "Corrections in Progress",
  resubmitted: "Resubmitted",
  approved: "Approved",
  finalized: "Finalized",
};

export const STATUS_ORDER: PaperStatus[] = [
  "draft",
  "uploaded",
  "assigned",
  "under_review",
  "changes_requested",
  "corrections_in_progress",
  "resubmitted",
  "approved",
  "finalized",
];

export const MARK_LABEL: Record<MarkStatus, string> = {
  none: "Not Reviewed",
  correct: "Correct",
  incorrect: "Incorrect",
  needs_improvement: "Needs Improvement",
  corrected: "Corrected",
  approved: "Approved",
};

/** Tailwind classes (semantic tokens) per mark. */
export const MARK_TONE: Record<MarkStatus, { bg: string; border: string; text: string; soft: string }> = {
  none: { bg: "bg-neutral", border: "border-neutral", text: "text-muted-foreground", soft: "bg-neutral/15" },
  correct: { bg: "bg-success", border: "border-success", text: "text-success", soft: "bg-success/15" },
  incorrect: { bg: "bg-destructive", border: "border-destructive", text: "text-destructive", soft: "bg-destructive/15" },
  needs_improvement: { bg: "bg-warning", border: "border-warning", text: "text-warning", soft: "bg-warning/20" },
  corrected: { bg: "bg-info", border: "border-info", text: "text-info", soft: "bg-info/15" },
  approved: { bg: "bg-success", border: "border-success", text: "text-success", soft: "bg-success/15" },
};

export function statusTone(s: PaperStatus) {
  if (s === "approved" || s === "finalized") return "bg-success/15 text-success";
  if (s === "changes_requested") return "bg-destructive/15 text-destructive";
  if (s === "corrections_in_progress") return "bg-warning/20 text-warning-foreground";
  if (s === "under_review" || s === "resubmitted") return "bg-info/15 text-info";
  return "bg-muted text-muted-foreground";
}

export function paperProgress(p: Paper, total: number, resolved: number) {
  if (p.status === "approved" || p.status === "finalized") return 100;
  const stage = Math.round((STATUS_ORDER.indexOf(p.status) / 7) * 60);
  const issues = total ? Math.round((resolved / total) * 40) : 0;
  return Math.min(99, stage + issues);
}

export function anchorLabel(a: Anchor | null | undefined) {
  if (!a || a.type === "general") return "General";
  if (a.type === "pdf") return `Page ${a.page}`;
  return `${a.sheet}!${a.cell}`;
}

export function colLetter(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function logActivity(paperId: string, action: string, details = "") {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("activity").insert({ paper_id: paperId, actor_id: data.user.id, action, details });
}
