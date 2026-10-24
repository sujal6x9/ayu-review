import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useProfiles } from "@/lib/auth";
import { logActivity } from "@/lib/papers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload paper — Question Paper Review Hub" },
      { name: "description", content: "Upload a PDF or Excel question paper and assign a reviewer." },
      { property: "og:title", content: "Upload paper — Question Paper Review Hub" },
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
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", exam_name: "", subject: "", test_number: "", reviewer_id: "" });

  function pick(f: File | undefined) {
    if (!f) return undefined;
    if (!fileKind(f)) { toast.error("Only PDF, XLSX or XLS files are allowed."); return; }
    if (f.size > MAX) { toast.error("File is larger than 50 MB."); return; }
    setFile(f);
    if (!form.title) setForm((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, "") }));
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
    <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-semibold text-primary">Upload question paper</h1>
      <form onSubmit={submit} className="mt-6 space-y-6">
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
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 py-10 sm:p-12 text-center transition ${drag ? "border-primary bg-accent" : "border-border bg-secondary/40 hover:border-primary"}`}
        >
          <UploadCloud className="h-8 w-8 text-primary" />
          <div className="mt-4 max-w-full break-all font-medium">{file ? file.name : "Drop a PDF or Excel file here, or click to browse"}</div>
          <div className="text-xs text-muted-foreground">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, XLSX, XLS · up to 50 MB"}
          </div>
          <input type="file" accept=".pdf,.xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>

        <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
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
            <Label>Assign reviewer</Label>
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
        </div>
        <Button className="h-11 w-full sm:w-auto" type="submit" disabled={busy || !file}>
          {busy ? "Uploading…" : "Upload & create paper"}
        </Button>
      </form>
    </main>
  );
}
