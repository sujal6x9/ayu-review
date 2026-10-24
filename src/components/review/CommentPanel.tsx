import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Search, Trash2, X } from "lucide-react";
import { canDeleteComment } from "@/lib/review-tools";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  MARK_LABEL,
  MARK_TONE,
  anchorLabel,
  logActivity,
  type Activity,
  type Anchor,
  type Comment,
  type MarkStatus,
} from "@/lib/papers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  paperId: string;
  meId: string;
  isAdmin: boolean;
  comments: Comment[];
  activity: Activity[];
  nameOf: (id: string) => string;
  pending: Anchor | null;
  clearPending: () => void;
  focusId: string | null;
  onFocus: (id: string) => void;
  onChanged: () => void;
};

const MARKS: MarkStatus[] = ["none", "correct", "incorrect", "needs_improvement", "corrected", "approved"];

export function CommentPanel(p: Props) {
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [q, setQ] = useState("");
  useEffect(() => { if (p.pending) setTab("comments"); }, [p.pending]);
  const threads = p.comments.filter((c) => !c.parent_id);
  const replies = (id: string) => p.comments.filter((c) => c.parent_id === id);

  const shown = threads.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    const s = q.toLowerCase();
    return !s || [t.body, t.question_ref, t.suggested_correction].some((v) => v.toLowerCase().includes(s));
  });

  useEffect(() => {
    if (p.focusId) {
      const t = threads.find((x) => x.id === p.focusId);
      if (t && filter !== "all" && t.status !== filter) setFilter("all");
      setTimeout(() => document.getElementById(`thread-${p.focusId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusId]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      <div className="flex shrink-0 border-b border-border/70 bg-card/90 text-sm">
        {(["comments", "activity"] as const).map((t) => (
          <Button variant="ghost" size="sm"
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px flex-1 border-b-2 py-2.5 capitalize ${tab === t ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground"}`}
          >
            {t} {t === "comments" && `(${threads.filter((x) => x.status === "open").length} open)`}
          </Button>
        ))}
      </div>

      {tab === "comments" ? (
        <>
          {p.pending && <Composer {...p} />}
          <div className="space-y-2 border-b border-border/70 bg-muted/30 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-8 pl-8 text-xs" placeholder="Search comments" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              {(["open", "resolved", "all"] as const).map((f) => (
                <Button variant="ghost" size="sm"
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-2.5 py-1 capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {f === "open" ? "Unresolved" : f}
                </Button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {shown.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No comments yet.
              </p>
            )}
            {shown.map((t) => (
              <Thread key={t.id} t={t} replies={replies(t.id)} {...p} />
            ))}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ol className="space-y-3 border-l pl-4">
            {p.activity.map((a) => (
              <li key={a.id} className="relative text-xs">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                <span className="font-medium">{p.nameOf(a.actor_id)}</span> {a.action}
                {a.details && <span className="text-muted-foreground"> — {a.details}</span>}
                <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Composer(p: Props) {
  const [body, setBody] = useState("");
  const [qref, setQref] = useState("");
  const [suggest, setSuggest] = useState("");
  const [mark, setMark] = useState<MarkStatus>("incorrect");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!body.trim()) return undefined;
    setBusy(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        paper_id: p.paperId,
        author_id: p.meId,
        anchor: p.pending as never,
        question_ref: qref.trim(),
        body: body.trim(),
        suggested_correction: suggest.trim(),
        mark,
      })
      .select()
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logActivity(p.paperId, "commented", `${qref ? qref + " · " : ""}${anchorLabel(p.pending)} · ${MARK_LABEL[mark]}`);
    p.clearPending();
    p.onChanged();
    p.onFocus(data.id);
  }

  return (
    <div className="shrink-0 space-y-2 border-b bg-accent/50 p-3 sm:p-4">
      <div className="flex items-center justify-between text-xs font-medium text-primary">
        New comment · {anchorLabel(p.pending)}
        <Button variant="ghost" size="sm" onClick={p.clearPending} aria-label="Cancel">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex gap-2">
        <Input className="h-8 w-24 text-xs" placeholder="Q no. e.g. Q25" value={qref} onChange={(e) => setQref(e.target.value)} />
        <Select value={mark} onValueChange={(v) => setMark(v as MarkStatus)}>
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MARKS.map((m) => (
              <SelectItem key={m} value={m}>
                {MARK_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea autoFocus rows={3} className="text-sm" placeholder="Describe the issue…" value={body} onChange={(e) => setBody(e.target.value)} />
      <Textarea rows={2} className="text-sm" placeholder="Suggested correction (optional)" value={suggest} onChange={(e) => setSuggest(e.target.value)} />
      <Button size="sm" className="w-full" disabled={busy || !body.trim()} onClick={save}>
        Save comment
      </Button>
    </div>
  );
}

function Thread({ t, replies, ...p }: Props & { t: Comment; replies: Comment[] }) {
  const [reply, setReply] = useState("");
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const tone = MARK_TONE[t.mark];
  const focused = p.focusId === t.id;

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("comments").delete().eq("id", deleting.id).select("id");
    setBusy(false);
    if (error || !data.length) { toast.error(error?.message || "You cannot delete this comment."); return; }
    await logActivity(p.paperId, deleting.parent_id ? "deleted reply" : "deleted comment", deleting.question_ref || anchorLabel(deleting.anchor as Anchor));
    setDeleting(null);
    p.onChanged();
    toast.success("Comment deleted");
  }

  async function update(patch: Partial<Comment>, action: string, details = "") {
    const { error } = await supabase.from("comments").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    await logActivity(p.paperId, action, details || t.question_ref || anchorLabel(t.anchor as Anchor));
    p.onChanged();
  }

  async function sendReply() {
    if (!reply.trim()) return;
    const { error } = await supabase.from("comments").insert({
      paper_id: p.paperId,
      author_id: p.meId,
      parent_id: t.id,
      anchor: t.anchor,
      body: reply.trim(),
    });
    if (error) { toast.error(error.message); return; }
    await logActivity(p.paperId, "replied", t.question_ref || anchorLabel(t.anchor as Anchor));
    setReply("");
    p.onChanged();
  }

  return (
    <div
      id={`thread-${t.id}`}
      onClick={() => p.onFocus(t.id)}
      className={`rounded-2xl border border-l-4 bg-card p-3 text-sm shadow-sm ${tone.border} ${focused ? "shadow-md ring-2 ring-ring/30" : ""} ${t.status === "resolved" ? "opacity-70" : ""}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
        {t.question_ref && <span className="rounded bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">{t.question_ref}</span>}
        <span className="font-mono text-muted-foreground">{anchorLabel(t.anchor as Anchor)}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 font-medium ${tone.soft} ${tone.text}`}>{MARK_LABEL[t.mark]}</span>
        {canDeleteComment(t.author_id, p.meId, p.isAdmin) && <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Delete comment" title="Delete comment" onClick={(e) => { e.stopPropagation(); setDeleting(t); }}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{p.nameOf(t.author_id)}</span> · {new Date(t.created_at).toLocaleString()}
      </div>
      <p className="mt-1 break-words whitespace-pre-wrap">{t.body}</p>
      {t.suggested_correction && (
        <div className="mt-2 rounded bg-info/10 p-2 text-xs">
          <div className="font-semibold text-info">Suggested correction</div>
          <div className="break-words whitespace-pre-wrap">{t.suggested_correction}</div>
        </div>
      )}
      {replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 pl-3">
          {replies.map((r) => (
            <div key={r.id} className="text-xs">
              <span className="font-medium">{p.nameOf(r.author_id)}</span>{" "}
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              {canDeleteComment(r.author_id, p.meId, p.isAdmin) && <Button size="icon" variant="ghost" className="ml-1 h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete reply" title="Delete reply" onClick={(e) => { e.stopPropagation(); setDeleting(r); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
              <p className="break-words whitespace-pre-wrap text-sm">{r.body}</p>
            </div>
          ))}
        </div>
      )}
      {focused && (
        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea rows={2} className="text-sm" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" disabled={!reply.trim()} onClick={sendReply}>
              Reply
            </Button>
            <Select value={t.mark} onValueChange={(v) => update({ mark: v as MarkStatus }, "changed mark", `${t.question_ref || anchorLabel(t.anchor as Anchor)} → ${MARK_LABEL[v as MarkStatus]}`)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MARK_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {t.status === "open" ? (
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => update({ status: "resolved" }, "resolved")}>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Resolve
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => update({ status: "open" }, "reopened")}>
                <RotateCcw className="h-3.5 w-3.5" /> Reopen
              </Button>
            )}
          </div>
        </div>
      )}
      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader><DialogTitle>Delete {deleting?.parent_id ? "reply" : "comment"}?</DialogTitle><DialogDescription>{deleting?.parent_id ? "This reply will be permanently removed." : "This comment, its mark, and any replies will be permanently removed."}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete permanently"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
