import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, MousePointer2, Search, SquareDashedMousePointer, ZoomIn, ZoomOut, MessageSquarePlus, FileText, MessagesSquare, ChartNoAxesColumn, PenLine, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useProfiles } from "@/lib/auth";
import {
  MARK_LABEL,
  MARK_TONE,
  STATUS_LABEL,
  anchorLabel,
  logActivity,
  statusTone,
  type Anchor,
  type CellAnchor,
  type Comment,
  type MarkStatus,
  type Paper,
  type PaperStatus,
  type PdfAnchor,
} from "@/lib/papers";
import { CommentPanel } from "@/components/review/CommentPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PdfViewer = lazy(() => import("@/components/review/PdfViewer").then((module) => ({ default: module.PdfViewer })));
const ExcelViewer = lazy(() => import("@/components/review/ExcelViewer").then((module) => ({ default: module.ExcelViewer })));

export const Route = createFileRoute("/_authenticated/papers/$paperId")({
  head: () => ({
    meta: [
      { title: "Review paper — Question Paper Review Hub" },
      { name: "description", content: "Review, comment on and approve a question paper." },
      { property: "og:title", content: "Review paper — Question Paper Review Hub" },
      { property: "og:description", content: "Collaborative question paper review workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const { paperId } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const nameOf = useCallback((id: string) => profiles.find((p) => p.id === id)?.full_name || "Someone", [profiles]);

  const paperQ = useQuery({
    queryKey: ["paper", paperId],
    queryFn: async () => {
      const { data, error } = await supabase.from("papers").select("*").eq("id", paperId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const paper = paperQ.data;

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", paperId],
    queryFn: async () => {
      const { data } = await supabase.from("comments").select("*").eq("paper_id", paperId).order("created_at");
      return data ?? [];
    },
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["activity", paperId],
    queryFn: async () => {
      const { data } = await supabase.from("activity").select("*").eq("paper_id", paperId).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const { data: fileData, error: fileErr } = useQuery({
    queryKey: ["file", paper?.file_path],
    enabled: !!paper?.file_path,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("papers").download(paper?.file_path ?? "");
      if (error) throw error;
      return await data.arrayBuffer();
    },
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["comments", paperId] });
    qc.invalidateQueries({ queryKey: ["activity", paperId] });
    qc.invalidateQueries({ queryKey: ["paper", paperId] });
  }, [qc, paperId]);

  const [live, setLive] = useState(false);
  useEffect(() => {
    const f = `paper_id=eq.${paperId}`;
    const ch = supabase
      .channel(`paper-${paperId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: f }, () =>
        qc.invalidateQueries({ queryKey: ["comments", paperId] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity", filter: f }, () =>
        qc.invalidateQueries({ queryKey: ["activity", paperId] }),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "papers", filter: `id=eq.${paperId}` }, () =>
        qc.invalidateQueries({ queryKey: ["paper", paperId] }),
      )
      .subscribe((s) => {
        setLive(s === "SUBSCRIBED");
        if (s === "SUBSCRIBED") refresh();
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [paperId, qc, refresh]);

  const [pending, setPending] = useState<Anchor | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<"select" | "area" | "pen">("select");
  const [penMark, setPenMark] = useState<MarkStatus>("incorrect");
  const [savingMarks, setSavingMarks] = useState(0);
  const [pages, setPages] = useState(0);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"document" | "comments" | "progress">("document");
  const createAnchor = (anchor: Anchor) => { setPending(anchor); setMobilePanel("comments"); };
  const savePenMark = async (anchor: Anchor) => {
    if (!me) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic: Comment = { id, paper_id: paperId, author_id: me.id, anchor: anchor as never, body: "Pen mark", mark: penMark, parent_id: null, question_ref: "", suggested_correction: "", status: "open", created_at: now, updated_at: now };
    qc.setQueryData<Comment[]>(["comments", paperId], (current = []) => [...current, optimistic]);
    setSavingMarks((count) => count + 1);
    const { error } = await supabase.from("comments").insert({ id, paper_id: paperId, author_id: me.id, anchor: anchor as never, body: "Pen mark", mark: penMark });
    setSavingMarks((count) => Math.max(0, count - 1));
    if (error) { qc.setQueryData<Comment[]>(["comments", paperId], (current = []) => current.filter((comment) => comment.id !== id)); toast.error(error.message); return; }
    refresh();
    toast.success("Mark saved");
  };

  const threads = comments.filter((c) => !c.parent_id);
  const focusThread = threads.find((t) => t.id === focusId) ?? null;

  const focus = useCallback(
    (id: string) => {
      setFocusId(id);
      const t = threads.find((x) => x.id === id);
      const a = t?.anchor as Anchor | undefined;
      setTimeout(() => {
        if (a?.type === "pdf") document.getElementById(`anchor-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        if (a?.type === "cell") document.getElementById(`cell-${a.sheet}-${a.cell}`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }, 80);
    },
    [threads],
  );

  const counts = useMemo(() => {
    const c: Record<MarkStatus, number> = { none: 0, correct: 0, incorrect: 0, needs_improvement: 0, corrected: 0, approved: 0 };
    threads.forEach((t) => c[t.mark]++);
    return c;
  }, [threads]);
  const resolved = threads.filter((t) => t.status === "resolved").length;
  const questions = useMemo(() => {
    const m = new Map<string, (typeof threads)[number]>();
    threads.forEach((t) => t.question_ref && !m.has(t.question_ref) && m.set(t.question_ref, t));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [threads]);

  if (paperQ.isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!paper) return <div className="p-8">This paper doesn’t exist or you don’t have access.</div>;

  const isUploader = me?.id === paper.uploader_id;
  const isReviewer = me?.id === paper.reviewer_id;
  const isAdmin = !!me?.roles.includes("admin");

  return (
    <div className="flex min-h-[calc(100svh-8rem)] min-w-0 flex-col pb-20 lg:h-[calc(100svh-4.5rem)] lg:pb-0">
      <WorkflowBar
        paper={paper}
        isUploader={isUploader || isAdmin}
        isReviewer={isReviewer || isAdmin}
        live={live}
        reviewers={profiles.filter((p) => p.roles.includes("reviewer"))}
        onChanged={refresh}
        openIssues={threads.length - resolved}
      />
      <nav aria-label="Review panels" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-1 border-t bg-background px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">{(["document", "comments", "progress"] as const).map((panel) => {
        const Icon = panel === "document" ? FileText : panel === "comments" ? MessagesSquare : ChartNoAxesColumn;
        return <Button key={panel} aria-pressed={mobilePanel === panel} variant={mobilePanel === panel ? "secondary" : "ghost"} className="h-12 min-w-0 flex-col gap-1 text-xs capitalize" onClick={() => setMobilePanel(panel)}><Icon className="h-4 w-4" />{panel}{panel === "comments" && threads.length > 0 ? ` (${threads.length})` : ""}</Button>;
      })}</nav>
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Left sidebar */}
        <aside className={`${mobilePanel === "progress" ? "block" : "hidden"} w-full min-w-0 overflow-y-auto border-r bg-sidebar p-4 text-sm lg:block lg:w-52 lg:shrink-0 xl:w-60`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review progress</h3>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={threads.length ? (resolved / threads.length) * 100 : 0} className="h-1.5" />
            <span className="text-xs">{resolved}/{threads.length}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Issues resolved</p>
          <ul className="mt-3 space-y-1">
            {(Object.keys(counts) as MarkStatus[]).map((m) => (
              <li key={m} className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${MARK_TONE[m].bg}`} />
                {MARK_LABEL[m]}
                <span className="ml-auto font-medium">{counts[m]}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions with comments</h3>
          {questions.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Add a question number (e.g. Q25) to a comment to list it here. Total question count is not detected automatically yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {questions.map(([q, t]) => (
                <Button variant="ghost" size="sm" key={q} onClick={() => focus(t.id)} className={`rounded px-2 py-1 text-xs font-medium text-primary-foreground ${MARK_TONE[t.mark].bg}`}>
                  {q}
                </Button>
              ))}
            </div>
          )}

          {paper.file_type === "pdf" ? (
            <>
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pages</h3>
              <div className="mt-2 grid grid-cols-5 gap-1">
                {Array.from({ length: pages }, (_, i) => {
                  const n = threads.filter((t) => (t.anchor as PdfAnchor).page === i + 1 && t.status === "open").length;
                  return (
                    <Button variant="ghost" size="sm"
                      key={i}
                      onClick={() => document.getElementById(`pdf-page-${i + 1}`)?.scrollIntoView({ behavior: "smooth" })}
                      className={`relative rounded border py-1 text-xs hover:bg-accent ${n ? "border-destructive" : ""}`}
                    >
                      {i + 1}
                    </Button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Worksheets</h3>
              <ul className="mt-2 space-y-1">
                {sheets.map((s) => (
                  <li key={s}>
                    <Button variant="ghost" size="sm" onClick={() => setSheet(s)} className={`w-full rounded px-2 py-1 text-left text-xs ${s === sheet ? "bg-accent font-medium text-primary" : "hover:bg-muted"}`}>
                      {s}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        {/* Center */}
        <section className={`${mobilePanel === "document" ? "flex" : "hidden"} h-[70svh] min-w-0 flex-1 flex-col bg-canvas lg:flex lg:h-auto`}>
          <div className="flex flex-wrap items-center gap-1 border-b bg-card px-3 py-2">
            <Button size="sm" variant={tool === "pen" ? "default" : "outline"} aria-pressed={tool === "pen"} onClick={() => setTool(tool === "pen" ? "select" : "pen")}><PenLine className="h-4 w-4" />Mark pen</Button>
            {tool === "pen" && <Select value={penMark} onValueChange={(value) => setPenMark(value as MarkStatus)}><SelectTrigger aria-label="Pen mark status" className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent>{(["incorrect", "correct", "needs_improvement", "corrected", "approved"] as MarkStatus[]).map((mark) => <SelectItem key={mark} value={mark}><span className={`mr-2 inline-block h-2 w-2 rounded-full ${MARK_TONE[mark].bg}`} />{MARK_LABEL[mark]}</SelectItem>)}</SelectContent></Select>}
            {savingMarks > 0 && <Loader2 aria-label="Saving mark" className="h-4 w-4 animate-spin text-muted-foreground" />}
            {paper.file_type === "pdf" ? (
              <>
                <Button size="sm" variant={tool === "area" ? "default" : "outline"} onClick={() => setTool("area")}>
                  <SquareDashedMousePointer className="h-4 w-4" /> Mark area
                </Button>
                <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")}>
                  <MousePointer2 className="h-4 w-4" /> Select
                </Button>
                <div className="mx-2 h-5 w-px bg-border" />
                <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                
              </>
            ) : (
              <>
                <div className="relative min-w-0 flex-1 sm:max-w-64">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="h-7 pl-8 text-xs" placeholder="Find in sheet" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => createAnchor({ type: "general" })} className="ml-auto"><MessageSquarePlus className="h-4 w-4" />Add comment</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Opening document…</div>}>
            {fileErr ? (
              <div className="p-8 text-destructive">Could not load the file.</div>
            ) : !fileData ? (
              <div className="p-8 text-muted-foreground">{paper.file_path ? "Loading file…" : "No file attached."}</div>
            ) : paper.file_type === "pdf" ? (
              <PdfViewer
                data={fileData}
                zoom={zoom}
                marking={tool === "area"}
                pen={tool === "pen"}
                penMark={penMark}
                onPen={savePenMark}
                threads={threads.filter((t) => (t.anchor as Anchor).type === "pdf")}
                pending={pending?.type === "pdf" ? pending : null}
                focusId={focusId}
                onCreate={createAnchor}
                onFocus={focus}
                onPages={setPages}
              />
            ) : (
              <ExcelViewer
                data={fileData}
                pen={tool === "pen"}
                onPen={savePenMark}
                threads={threads.filter((t) => (t.anchor as Anchor).type === "cell")}
                pending={pending?.type === "cell" ? pending : null}
                focusAnchor={(focusThread?.anchor as Anchor)?.type === "cell" ? (focusThread?.anchor as CellAnchor) : null}
                focusId={focusId}
                search={search}
                onCreate={createAnchor}
                onFocus={focus}
                onSheets={setSheets}
                sheet={sheet}
                setSheet={setSheet}
              />
            )}
            </Suspense>
          </div>
        </section>

        {/* Right */}
        <aside className={`${mobilePanel === "comments" ? "block" : "hidden"} h-[70svh] w-full min-w-0 border-l bg-card lg:block lg:h-auto lg:w-80 lg:shrink-0 xl:w-96`}>
          <div className="flex items-center justify-between border-b px-3 py-2 lg:hidden"><span className="text-sm font-semibold">Review comments</span><Button size="sm" variant="outline" onClick={() => createAnchor({ type: "general" })}><MessageSquarePlus className="h-4 w-4" />Add comment</Button></div>
          {me && (
            <CommentPanel
              paperId={paper.id}
              meId={me.id}
              isAdmin={isAdmin}
              comments={comments}
              activity={activity}
              nameOf={nameOf}
              pending={pending}
              clearPending={() => setPending(null)}
              focusId={focusId}
              onFocus={focus}
              onChanged={refresh}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function WorkflowBar({
  paper,
  isUploader,
  isReviewer,
  live,
  reviewers,
  onChanged,
  openIssues,
}: {
  paper: Paper;
  isUploader: boolean;
  isReviewer: boolean;
  live: boolean;
  reviewers: { id: string; full_name: string }[];
  onChanged: () => void;
  openIssues: number;
}) {
  async function setStatus(status: PaperStatus, label: string, extra: Partial<Paper> = {}) {
    const { error } = await supabase.from("papers").update({ status, ...extra }).eq("id", paper.id);
    if (error) { toast.error(error.message); return; }
    await logActivity(paper.id, label, STATUS_LABEL[status]);
    toast.success(`Paper ${STATUS_LABEL[status].toLowerCase()}`);
    onChanged();
  }

  async function assign(id: string) {
    const r = reviewers.find((x) => x.id === id);
    const status: PaperStatus = ["uploaded", "draft"].includes(paper.status) ? "assigned" : paper.status;
    const { error } = await supabase.from("papers").update({ reviewer_id: id, status }).eq("id", paper.id);
    if (error) { toast.error(error.message); return; }
    await logActivity(paper.id, "assigned reviewer", r?.full_name ?? "");
    onChanged();
  }

  async function download() {
    if (!paper.file_path) return;
    const { data, error } = await supabase.storage.from("papers").createSignedUrl(paper.file_path, 300, { download: paper.file_name ?? true });
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  const s = paper.status;
  const actions: { label: string; onClick: () => void; variant?: "default" | "outline" | "destructive" }[] = [];
  if (isReviewer && ["assigned", "resubmitted", "uploaded"].includes(s))
    actions.push({ label: "Start review", onClick: () => setStatus("under_review", "started review") });
  if (isReviewer && s === "under_review") {
    actions.push({ label: "Request changes", variant: "destructive", onClick: () => setStatus("changes_requested", "requested changes", { review_cycle: paper.review_cycle + 1 }) });
    actions.push({
      label: "Approve paper",
      onClick: () => {
        if (openIssues > 0 && !confirm(`${openIssues} comments are still unresolved. Approve anyway?`)) return;
        setStatus("approved", "approved the paper", { review_cycle: paper.review_cycle + 1 });
      },
    });
  }
  if (isUploader && s === "changes_requested")
    actions.push({ label: "Start corrections", variant: "outline", onClick: () => setStatus("corrections_in_progress", "started corrections") });
  if (isUploader && ["changes_requested", "corrections_in_progress"].includes(s))
    actions.push({ label: "Resubmit for review", onClick: () => setStatus("resubmitted", "resubmitted") });
  if (isUploader && s === "approved") actions.push({ label: "Finalize", onClick: () => setStatus("finalized", "finalized") });

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b bg-card px-4 py-3">
      <Link to="/dashboard" className="text-muted-foreground hover:text-foreground" aria-label="Back">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words font-display text-lg font-semibold text-primary">{paper.title}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(s)}`}>{STATUS_LABEL[s]}</span>
        </div>
        <div className="break-words font-mono text-xs text-muted-foreground">
          {paper.paper_code} · {[paper.exam_name, paper.subject, paper.test_number && `Test ${paper.test_number}`].filter(Boolean).join(" · ")} · Review cycles: {paper.review_cycle}
        </div>
      </div>
      <span className={`col-span-2 flex items-center gap-1.5 text-xs ${live ? "text-success" : "text-muted-foreground"}`}>
        <span className={`h-2 w-2 rounded-full ${live ? "bg-success" : "bg-neutral"}`} />
        {live ? "Live" : "Reconnecting…"}
      </span>
      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2">
        {isUploader && (
          <Select value={paper.reviewer_id ?? ""} onValueChange={assign}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Assign reviewer" />
            </SelectTrigger>
            <SelectContent>
              {reviewers.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  Reviewer: {r.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" variant="ghost" onClick={download}>
          <Download className="h-4 w-4" /> Original
        </Button>
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant={a.variant ?? "default"} onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

