import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Search, Upload, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useProfiles } from "@/lib/auth";
import { STATUS_LABEL, paperProgress, statusTone, type Paper } from "@/lib/papers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ayu Review" },
      { name: "description", content: "All your uploaded and assigned question papers." },
      { property: "og:title", content: "Dashboard — Ayu Review" },
      { property: "og:description", content: "Track review progress for every paper." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type View = "all" | "uploads" | "assigned" | "completed";

function Dashboard() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");

  const { data: papers = [], isPending: papersLoading, isError: papersError, refetch } = useQuery({
    queryKey: ["papers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("papers").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["comment-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("comments").select("paper_id,status,parent_id");
      return (data ?? []).filter((c) => !c.parent_id);
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`dash-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "papers" }, () =>
        qc.invalidateQueries({ queryKey: ["papers"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () =>
        qc.invalidateQueries({ queryKey: ["comment-stats"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const names = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.full_name])), [profiles]);
  const nameOf = (id: string | null) => (id ? names.get(id) || "—" : "Unassigned");
  const commentCounts = useMemo(() => {
    const counts = new Map<string, { total: number; open: number }>();
    for (const comment of comments) {
      const count = counts.get(comment.paper_id) ?? { total: 0, open: 0 };
      count.total += 1;
      if (comment.status === "open") count.open += 1;
      counts.set(comment.paper_id, count);
    }
    return counts;
  }, [comments]);
  const stats = (p: Paper) => commentCounts.get(p.id) ?? { total: 0, open: 0 };

  const isAdmin = me?.roles.includes("admin");
  const views: { key: View; label: string }[] = [
    { key: "all", label: isAdmin ? "All papers (admin)" : "All my papers" },
    { key: "uploads", label: "My uploads" },
    { key: "assigned", label: "Assigned reviews" },
    { key: "completed", label: "Completed" },
  ];

  const filtered = useMemo(() => {
    return papers.filter((p) => {
      if (view === "uploads" && p.uploader_id !== me?.id) return false;
      if (view === "assigned" && p.reviewer_id !== me?.id) return false;
      if (view === "completed" && !["approved", "finalized"].includes(p.status)) return false;
      const s = q.toLowerCase();
      return !s || [p.title, p.paper_code, p.subject, p.exam_name].some((v) => v.toLowerCase().includes(s));
    });
  }, [papers, view, q, me]);

  const unresolved = comments.filter((c) => c.status === "open").length;
  const cards = [
    { label: "Total papers", value: papers.length },
    { label: "Pending review", value: papers.filter((p) => ["uploaded", "assigned", "resubmitted"].includes(p.status)).length },
    { label: "Under review", value: papers.filter((p) => p.status === "under_review").length },
    { label: "Corrections required", value: papers.filter((p) => ["changes_requested", "corrections_in_progress"].includes(p.status)).length, tone: "text-destructive" },
    { label: "Approved", value: papers.filter((p) => ["approved", "finalized"].includes(p.status)).length, tone: "text-success" },
    { label: "Unresolved comments", value: unresolved, tone: "text-warning" },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-5 min-[380px]:px-4 sm:px-6 sm:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-4"><div className="min-w-0"><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:mb-2 sm:text-xs">Your workspace</p><h1 className="font-display text-2xl font-semibold text-foreground min-[380px]:text-3xl sm:text-4xl">Question papers</h1><p className="mt-2 hidden text-sm text-muted-foreground sm:block">Track every review from upload to final approval.</p></div>{(me?.roles.includes("uploader") || isAdmin) && <Button asChild size="sm" className="shrink-0 sm:h-10 sm:px-4"><Link to="/upload"><Upload className="h-4 w-4" /><span className="hidden sm:inline">Upload paper</span><span className="sm:hidden">Upload</span></Link></Button>}</div>
      <div className="mt-5 grid grid-cols-2 gap-2 min-[380px]:gap-3 sm:mt-7 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="min-w-0 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur min-[380px]:rounded-2xl sm:p-4">
            <div className="min-h-7 text-[10px] font-semibold uppercase leading-3.5 tracking-wide text-muted-foreground min-[380px]:text-[11px]">{c.label}</div>
            <div className={`mt-1.5 font-display text-2xl font-semibold min-[380px]:mt-3 min-[380px]:text-3xl ${c.tone ?? "text-foreground"}`}>{papersLoading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm backdrop-blur sm:mt-8 sm:flex sm:items-center">
        <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{views.map((v) => (
          <Button variant={view === v.key ? "secondary" : "ghost"} key={v.key} onClick={() => setView(v.key)} className={`shrink-0 ${view === v.key ? "text-primary" : "text-muted-foreground"}`}>{v.label}</Button>
        ))}</div>
        <div className="relative mt-2 w-full sm:ml-auto sm:mt-0 sm:w-64">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search papers" placeholder="Search papers" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:hidden">
        {filtered.map((p) => {
          const s = stats(p); const prog = paperProgress(p, s.total, s.total - s.open);
          return <article key={p.id} className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-3.5 shadow-sm min-[380px]:p-4">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${p.file_type === "excel" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{p.file_type === "excel" ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><div className="min-w-0"><Link to="/papers/$paperId" params={{ paperId: p.id }} className="flex min-w-0 items-start gap-1 font-semibold leading-snug text-foreground"><span className="min-w-0 break-all min-[380px]:break-words">{p.title}</span><ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /></Link><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground min-[380px]:text-[11px]">{p.paper_code} · {new Date(p.created_at).toLocaleDateString()}</p></div><span className={`col-start-2 w-fit rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone(p.status)}`}>{STATUS_LABEL[p.status]}</span></div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-xs min-[380px]:grid-cols-2"><div className="min-w-0"><p className="text-muted-foreground">Exam / subject</p><p className="mt-1 break-words font-medium">{[p.exam_name, p.subject].filter(Boolean).join(" · ") || "—"}</p></div><div className="min-w-0"><p className="text-muted-foreground">Reviewer</p><p className="mt-1 break-words font-medium">{nameOf(p.reviewer_id)}</p></div></div>
            <div className="mt-4 border-t border-border/70 pt-3"><div className="mb-2 flex items-center justify-between text-xs"><span className={s.open ? "font-medium text-destructive" : "text-muted-foreground"}>{s.open ? `${s.open} unresolved` : `${s.total} comments`}</span><span className="font-semibold">{prog}%</span></div><Progress value={prog} className="h-1.5" /></div>
          </article>;
        })}
        {filtered.length === 0 && <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground">{papersLoading ? "Loading papers…" : q ? "No matching papers" : "No papers here yet"}</div>}
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-sm xl:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Paper</th>
              <th className="px-4 py-3">Exam / Subject</th>
              <th className="px-4 py-3">Uploader</th>
              <th className="px-4 py-3">Reviewer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issues</th>
              <th className="px-4 py-3 w-40">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => {
              const s = stats(p);
              const prog = paperProgress(p, s.total, s.total - s.open);
              return (
                <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-accent/25">
                  <td className="px-4 py-3">
                    <Link to="/papers/$paperId" params={{ paperId: p.id }} className="flex items-center gap-2 font-medium text-primary hover:underline">
                      {p.file_type === "excel" ? <FileSpreadsheet className="h-4 w-4 text-success" /> : <FileText className="h-4 w-4 text-destructive" />}
                      {p.title}<ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </Link>
                    <div className="ml-6 font-mono text-xs text-muted-foreground">
                      {p.paper_code} · {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.exam_name || "—"}
                    {p.test_number && ` #${p.test_number}`}
                    <div className="text-xs">{p.subject}</div>
                  </td>
                  <td className="px-4 py-3">{nameOf(p.uploader_id)}</td>
                  <td className="px-4 py-3">{nameOf(p.reviewer_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(p.status)}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.total} comments
                    {s.open > 0 && <div className="text-destructive">{s.open} unresolved</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={prog} className="h-1.5" />
                      <span className="w-9 text-xs text-muted-foreground">{prog}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  {papersLoading ? "Loading papers…" : papersError ? <div className="space-y-3"><p>Could not load your papers.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button></div> : <div className="flex flex-col items-center gap-3"><FileText className="h-7 w-7 text-muted-foreground" /><p className="font-medium text-foreground">{q ? "No matching papers" : "No papers here yet"}</p>{q && <Button variant="ghost" size="sm" onClick={() => setQ("")}>Clear search</Button>}</div>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
