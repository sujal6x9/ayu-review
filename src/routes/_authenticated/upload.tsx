import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { logActivity } from "@/lib/papers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload paper — Ayu Review" },
      { name: "description", content: "Upload a PDF or Excel question paper." },
    ],
  }),
  component: UploadPage,
});
const MAX = 50 * 1024 * 1024;
function fileKind(f: File): "pdf" | "excel" | null {
  const n = f.name.toLowerCase();
  return n.endsWith(".pdf") ? "pdf" : n.endsWith(".xlsx") || n.endsWith(".xls") ? "excel" : null;
}

function UploadPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", exam_name: "", subject: "", test_number: "" });
  function pick(f?: File) {
    if (!f) return;
    if (!fileKind(f)) return void toast.error("Only PDF, XLSX or XLS files are allowed.");
    if (f.size > MAX) return void toast.error("File is larger than 50 MB.");
    setFile(f);
    if (!form.title) setForm((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, "") }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !me) return void toast.error("Choose a file first.");
    setBusy(true);
    try {
      const kind = fileKind(file);
      if (!kind) throw new Error("Choose a PDF or Excel file.");
      const { data: paper, error } = await supabase
        .from("papers")
        .insert({
          ...form,
          uploader_id: me.id,
          reviewer_id: null,
          doctor_id: null,
          file_type: kind,
          file_name: file.name,
          status: "uploaded",
        })
        .select()
        .single();
      if (error) throw error;
      const path = `${paper.id}/original/${file.name.replace(/[^\w.-]+/g, "_")}`;
      const upload = await supabase.storage
        .from("papers")
        .upload(path, file, file.type ? { contentType: file.type } : {});
      if (upload.error) throw upload.error;
      await supabase.from("papers").update({ file_path: path }).eq("id", paper.id);
      await logActivity(paper.id, "uploaded", file.name);
      await qc.invalidateQueries({ queryKey: ["papers"] });
      toast.success(`Paper ${paper.paper_code} uploaded. Use Share to assign a Dr.`);
      navigate({ to: "/papers/$paperId", params: { paperId: paper.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">New review</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          Upload question paper
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload the original first. You can assign a Dr and protect the share link from the paper
          page.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="mt-7 space-y-6 rounded-3xl border border-border/70 bg-card/85 p-4 shadow-[0_24px_60px_-45px_rgba(15,65,75,.7)] sm:p-7"
      >
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
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition sm:p-12 ${drag ? "border-primary bg-accent" : "border-border bg-secondary/35 hover:border-primary"}`}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
            <UploadCloud className="h-7 w-7 text-primary" />
          </span>
          <div className="mt-4 max-w-full break-all font-medium">
            {file ? file.name : "Drop a PDF or Excel file here, or click to browse"}
          </div>
          <div className="text-xs text-muted-foreground">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, XLSX, XLS · up to 50 MB"}
          </div>
          <input
            type="file"
            accept=".pdf,.xlsx,.xls"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
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
        </div>
        <Button className="h-12 w-full sm:w-auto" disabled={busy || !file}>
          {busy ? "Uploading…" : "Upload paper"}
        </Button>
      </form>
    </main>
  );
}
