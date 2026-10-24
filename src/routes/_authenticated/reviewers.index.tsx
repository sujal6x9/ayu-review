import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowUpRight, Eye, EyeOff, Search, Stethoscope, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { doctorName } from "@/lib/accounts";
import { useMe, useProfiles } from "@/lib/auth";
import { createReviewerAccount } from "@/lib/reviewer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/reviewers/")({
  head: () => ({ meta: [{ title: "Drs — Ayu Review" }, { name: "description", content: "Manage Dr access and paper assignments." }] }),
  component: DoctorsPage,
});

function DoctorsPage() {
  const qc = useQueryClient();
  const createDoctor = useServerFn(createReviewerAccount);
  const { data: me, isPending: mePending } = useMe();
  const { data: profiles = [], isPending: profilesPending } = useProfiles();
  const canManage = !!me && (me.roles.includes("uploader") || me.roles.includes("admin"));
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const { data: papers = [] } = useQuery({
    queryKey: ["dr-paper-assignments"],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from("papers").select("id,reviewer_id,status");
      if (error) throw error;
      return data;
    },
  });
  const doctors = useMemo(() => profiles
    .filter((profile) => profile.roles.includes("reviewer"))
    .filter((profile) => !query.trim() || `${profile.full_name} ${profile.email}`.toLowerCase().includes(query.trim().toLowerCase())), [profiles, query]);

  async function submitDoctor(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await createDoctor({ data: form });
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      setForm({ fullName: "", email: "", password: "" });
      setShowCreate(false);
      toast.success(`${doctorName(created.fullName)} created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create Dr account.");
    } finally {
      setBusy(false);
    }
  }

  if (mePending || profilesPending) return <main className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading Dr directory…</main>;
  if (!canManage) return <main className="mx-auto w-full max-w-5xl px-4 py-10"><h1 className="font-display text-3xl font-semibold">Dr directory unavailable</h1><p className="mt-3 text-muted-foreground">Only paper creators and administrators can manage Drs.</p></main>;

  return <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Access & assignments</p><h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Dr directory</h1><p className="mt-2 text-sm text-muted-foreground">Create Dr access and see every assigned paper.</p></div><Button onClick={() => setShowCreate((shown) => !shown)}><UserPlus className="h-4 w-4" />New Dr</Button></div>

    {showCreate && <form onSubmit={submitDoctor} className="mt-6 rounded-3xl border border-primary/20 bg-card/90 p-4 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="dr-name">Dr name</Label><Input id="dr-name" required value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="dr-email">Email</Label><Input id="dr-email" type="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dr-password">Review password</Label><div className="relative"><Input id="dr-password" type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" className="pr-12" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div></div>
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={() => setShowCreate(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Creating…" : "Create Dr"}</Button></div>
    </form>}

    <div className="relative mt-7 max-w-md"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search Drs" aria-label="Search Drs" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {doctors.map((doctor) => {
        const assigned = papers.filter((paper) => paper.reviewer_id === doctor.id);
        const active = assigned.filter((paper) => !["approved", "finalized"].includes(paper.status)).length;
        return <Link key={doctor.id} to="/reviewers/$reviewerId" params={{ reviewerId: doctor.id }} className="group min-w-0 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Stethoscope className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate font-display text-lg font-semibold">{doctorName(doctor.full_name)}</h2><p className="mt-1 truncate text-xs text-muted-foreground">{doctor.email}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-sm"><div><p className="text-xs text-muted-foreground">Assigned papers</p><p className="mt-1 font-semibold">{assigned.length}</p></div><div><p className="text-xs text-muted-foreground">Active</p><p className="mt-1 font-semibold">{active}</p></div></div>
        </Link>;
      })}
      {doctors.length === 0 && <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">{query ? "No matching Drs" : "No Dr accounts yet"}</div>}
    </div>
  </main>;
}
