import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus, UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useProfiles } from "@/lib/auth";
import { logActivity } from "@/lib/papers";
import { createReviewerAccount } from "@/lib/reviewer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload paper — Ayu Review" },
      { name: "description", content: "Upload a PDF or Excel question paper and assign a reviewer." },
      { property: "og:title", content: "Upload paper — Ayu Review" },
      { property: "og:description", content: "Upload a question paper for review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const MAX = 50 * 1024 * 1024;

function fileKind(f: File): "pdf" | "excel" | null {
  const n = f.name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "excel";
  return null;
}

function UploadPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const reviewers = profiles.filter((p) => p.roles.includes("reviewer") && p.id !== me?.id);
  const createReviewer = useServerFn(createReviewerAccount);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creatingReviewer, setCreatingReviewer] = useState(false);
  const [showReviewerForm, setShowReviewerForm] = useState(false);
  const [showReviewerPassword, setShowReviewerPassword] = useState(false);
  const [reviewerForm, setReviewerForm] = useState({ fullName: "", email: "", password: "" });
  const [form, setForm] = useState({ title: "", exam_name: "", subject: "", test_number: "", reviewer_id: "" });

  function pick(f: File | undefined) {
    if (!f) return undefined;
    if (!fileKind(f)) { toast.error("Only PDF, XLSX or XLS files are allowed."); return; }
    if (f.size > MAX) { toast.error("File is larger than 50 MB."); return; }
    setFile(f);
    if (!form.title) setForm((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, "") }));
  }

  async function addReviewer() {
    setCreatingReviewer(true);
    try {
      const reviewer = await createReviewer({ data: reviewerForm });
      setForm((current) => ({ ...current, reviewer_id: reviewer.id }));
      setReviewerForm({ fullName: "", email: "", password: "" });
      setShowReviewerForm(false);
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(`${reviewer.fullName} can now review papers.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create reviewer.");
    } finally {
      setCreatingReviewer(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !me) { toast.error("Choose a file first."); return; }
    setBusy(true);
    try {
      const kind = fileKind(file);
      if (!kind) throw new Error("Choose a PDF or Excel file.");
      const { data: paper, error } = await supabase
        .from("papers")
        .insert({
          title: form.title,
          exam_name: form.exam_name,
          subject: form.subject,
          test_number: form.test_number,
          uploader_id: me.id,
          reviewer_id: form.reviewer_id || null,
          file_type: kind,
          file_name: file.name,
          status: form.reviewer_id ? "assigned" : "uploaded",
        })
        .select()
        .single();
      if (error) throw error;
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${paper.id}/original/${safe}`;
      const up = await supabase.storage.from("papers").upload(path, file, file.type ? { contentType: file.type } : {});
      if (up.error) throw up.error;
      await supabase.from("papers").update({ file_path: path }).eq("id", paper.id);
      await logActivity(paper.id, "uploaded", file.name);
      if (form.reviewer_id) {
        const r = profiles.find((p) => p.id === form.reviewer_id);
        await logActivity(paper.id, "assigned reviewer", r?.full_name ?? "");
      }
      qc.invalidateQueries({ queryKey: ["papers"] });
      toast.success(`Paper ${paper.paper_code} created`);
      navigate({ to: "/papers/$paperId", params: { paperId: paper.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">New review</p><h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">Upload question paper</h1><p className="mt-2 text-sm text-muted-foreground">Add the original file and route it to the right reviewer.</p></div>
      <form onSubmit={submit} className="mt-7 space-y-6 rounded-3xl border border-border/70 bg-card/85 p-4 shadow-[0_24px_60px_-45px_rgba(15,65,75,.7)] backdrop-blur sm:p-7">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition sm:p-12 ${drag ? "border-primary bg-accent" : "border-border bg-secondary/35 hover:border-primary hover:bg-accent/40"}`}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10"><UploadCloud className="h-7 w-7 text-primary" /></span>
          <div className="mt-4 max-w-full break-all font-medium">{file ? file.name : "Drop a PDF or Excel file here, or click to browse"}</div>
          <div className="text-xs text-muted-foreground">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, XLSX, XLS · up to 50 MB"}
          </div>
          <input type="file" accept=".pdf,.xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>

        <div className="grid gap-5 border-t border-border/70 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Paper title</Label>
            <Input required value={form.title} onChange={set("title")} />
          </div>
          <div className="space-y-1.5">
            <Label>Exam name</Label>
            <Input value={form.exam_name} onChange={set("exam_name")} placeholder="e.g. AIAPGET" />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={form.subject} onChange={set("subject")} />
          </div>
          <div className="space-y-1.5">
            <Label>Test number</Label>
            <Input value={form.test_number} onChange={set("test_number")} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2"><Label>Assign reviewer</Label><Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowReviewerForm((shown) => !shown)}><UserPlus className="h-3.5 w-3.5" />New reviewer</Button></div>
            <Select value={form.reviewer_id} onValueChange={(v) => setForm((s) => ({ ...s, reviewer_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder={reviewers.length ? "Choose reviewer" : "No reviewers signed up yet"} />
              </SelectTrigger>
              <SelectContent>
                {reviewers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.full_name} · {r.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showReviewerForm && <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:col-span-2">
            <div><h2 className="font-semibold">Create reviewer access</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Set the credentials the reviewer will use when opening a shared paper link.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="reviewer-name">Reviewer name</Label><Input id="reviewer-name" value={reviewerForm.fullName} onChange={(event) => setReviewerForm((current) => ({ ...current, fullName: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="reviewer-email">Reviewer email</Label><Input id="reviewer-email" type="email" value={reviewerForm.email} onChange={(event) => setReviewerForm((current) => ({ ...current, email: event.target.value }))} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="reviewer-password">Review password</Label><div className="relative"><Input id="reviewer-password" type={showReviewerPassword ? "text" : "password"} minLength={8} autoComplete="new-password" className="pr-11" value={reviewerForm.password} onChange={(event) => setReviewerForm((current) => ({ ...current, password: event.target.value }))} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8" aria-label={showReviewerPassword ? "Hide password" : "Show password"} onClick={() => setShowReviewerPassword((shown) => !shown)}>{showReviewerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
            </div>
            <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowReviewerForm(false)}>Cancel</Button><Button type="button" disabled={creatingReviewer || reviewerForm.fullName.trim().length === 0 || reviewerForm.email.trim().length === 0 || reviewerForm.password.length < 8} onClick={addReviewer}><UserPlus className="h-4 w-4" />{creatingReviewer ? "Creating…" : "Create & select"}</Button></div>
          </div>}
        </div>
        <Button className="h-12 w-full sm:w-auto" type="submit" disabled={busy || !file}>
          {busy ? "Uploading…" : "Upload & create paper"}
        </Button>
      </form>
    </main>
  );
}
