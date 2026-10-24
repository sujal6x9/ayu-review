import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, FileSpreadsheet, FileText, Mail, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { doctorName } from "@/lib/accounts";
import { useMe, useProfiles } from "@/lib/auth";
import { STATUS_LABEL, statusTone } from "@/lib/papers";

export const Route = createFileRoute("/_authenticated/reviewers/$reviewerId")({
  head: () => ({ meta: [{ title: "Dr assignments — Ayu Review" }, { name: "description", content: "Papers assigned to this Dr." }] }),
  component: DoctorDetailPage,
});

function DoctorDetailPage() {
  const { reviewerId } = Route.useParams();
  const { data: me, isPending: mePending } = useMe();
  const { data: profiles = [], isPending: profilesPending } = useProfiles();
  const canManage = !!me && (me.roles.includes("uploader") || me.roles.includes("admin"));
  const doctor = profiles.find((profile) => profile.id === reviewerId && profile.roles.includes("reviewer"));
  const { data: papers = [], isPending } = useQuery({
    queryKey: ["dr-papers", reviewerId],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from("papers").select("*").eq("reviewer_id", reviewerId).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (mePending || profilesPending) return <main className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading Dr assignments…</main>;
  if (!canManage) return <main className="mx-auto w-full max-w-5xl px-4 py-10"><h1 className="font-display text-3xl font-semibold">Dr assignments unavailable</h1><p className="mt-3 text-muted-foreground">Only paper creators and administrators can view Dr assignments.</p></main>;
  if (!doctor) return <main className="mx-auto w-full max-w-5xl px-4 py-10"><Link to="/reviewers" className="text-sm text-primary">Back to Drs</Link><h1 className="mt-5 font-display text-3xl font-semibold">Dr not found</h1></main>;

  const active = papers.filter((paper) => !["approved", "finalized"].includes(paper.status)).length;
  const completed = papers.length - active;
  return <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
    <Link to="/reviewers" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />All Drs</Link>
    <section className="mt-5 rounded-3xl border border-border/70 bg-card/90 p-5 shadow-sm sm:p-7">
      <div className="flex min-w-0 items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Stethoscope className="h-6 w-6" /></span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Dr profile</p><h1 className="mt-1 break-words font-display text-2xl font-semibold sm:text-3xl">{doctorName(doctor.full_name)}</h1><p className="mt-2 flex items-center gap-2 break-all text-sm text-muted-foreground"><Mail className="h-4 w-4 shrink-0" />{doctor.email}</p></div></div>
      <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5 text-center sm:max-w-lg sm:gap-4"><div><p className="font-display text-2xl font-semibold">{papers.length}</p><p className="text-xs text-muted-foreground">Assigned</p></div><div><p className="font-display text-2xl font-semibold text-warning">{active}</p><p className="text-xs text-muted-foreground">Active</p></div><div><p className="font-display text-2xl font-semibold text-success">{completed}</p><p className="text-xs text-muted-foreground">Completed</p></div></div>
    </section>

    <div className="mb-3 mt-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Assignments</p><h2 className="mt-1 font-display text-2xl font-semibold">Assigned papers</h2></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {papers.map((paper) => <Link key={paper.id} to="/papers/$paperId" params={{ paperId: paper.id }} className="group min-w-0 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md">
        <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${paper.file_type === "excel" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{paper.file_type === "excel" ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{paper.title}</h3><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" /></div><p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{paper.paper_code}</p></div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone(paper.status)}`}>{STATUS_LABEL[paper.status]}</span><span className="text-xs text-muted-foreground">Updated {new Date(paper.updated_at).toLocaleDateString()}</span></div>
      </Link>)}
      {papers.length === 0 && <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground sm:col-span-2">{isPending ? "Loading papers…" : "No papers are assigned to this Dr yet."}</div>}
    </div>
  </main>;
}
