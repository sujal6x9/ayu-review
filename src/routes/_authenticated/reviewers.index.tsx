import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search, Stethoscope, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { doctorName } from "@/lib/accounts";
import { useDoctors, useMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/reviewers/")({
  head: () => ({
    meta: [
      { title: "Drs — Ayu Review" },
      { name: "description", content: "Manage Drs and paper assignments." },
    ],
  }),
  component: DoctorsPage,
});

function DoctorsPage() {
  const qc = useQueryClient();
  const { data: me, isPending: mePending } = useMe();
  const { data: allDoctors = [], isPending: doctorsPending } = useDoctors();
  const canManage = !!me && (me.roles.includes("uploader") || me.roles.includes("admin"));
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", specialization: "" });
  const { data: papers = [] } = useQuery({
    queryKey: ["dr-paper-assignments"],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from("papers").select("id,doctor_id,status");
      if (error) throw error;
      return data;
    },
  });
  const doctors = useMemo(
    () =>
      allDoctors.filter(
        (doctor) =>
          !query.trim() ||
          `${doctor.name} ${doctor.specialization ?? ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [allDoctors, query],
  );

  async function submitDoctor(event: React.FormEvent) {
    event.preventDefault();
    if (!me) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("doctors").insert({
        name: form.name.trim(),
        specialization: form.specialization.trim() || null,
        created_by: me.id,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["doctors"] });
      toast.success(`${doctorName(form.name)} added`);
      setForm({ name: "", specialization: "" });
      setShowCreate(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add Dr.");
    } finally {
      setBusy(false);
    }
  }

  if (mePending || doctorsPending)
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        Loading Dr directory…
      </main>
    );
  if (!canManage)
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="font-display text-3xl font-semibold">Dr directory unavailable</h1>
        <p className="mt-3 text-muted-foreground">
          Only paper creators and administrators can manage Drs.
        </p>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Assignments
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Dr directory</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Save Dr details and see their assigned papers. Drs do not need an account.
          </p>
        </div>
        <Button onClick={() => setShowCreate((shown) => !shown)}>
          <UserPlus className="h-4 w-4" />
          New Dr
        </Button>
      </div>
      {showCreate && (
        <form
          onSubmit={submitDoctor}
          className="mt-6 rounded-3xl border border-primary/20 bg-card/90 p-4 shadow-sm sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dr-name">Dr name</Label>
              <Input
                id="dr-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-specialization">
                Specialization <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="dr-specialization"
                placeholder="e.g. BAMS"
                value={form.specialization}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button disabled={busy || !form.name.trim()}>{busy ? "Adding…" : "Add Dr"}</Button>
          </div>
        </form>
      )}
      <div className="relative mt-7 max-w-md">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search Drs or specialization"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((doctor) => {
          const assigned = papers.filter((paper) => paper.doctor_id === doctor.id);
          const active = assigned.filter(
            (paper) => !["approved", "finalized"].includes(paper.status),
          ).length;
          return (
            <Link
              key={doctor.id}
              to="/reviewers/$reviewerId"
              params={{ reviewerId: doctor.id }}
              className="group min-w-0 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg font-semibold">
                    {doctorName(doctor.name)}
                  </h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {doctor.specialization || "Specialization not added"}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Assigned papers</p>
                  <p className="mt-1 font-semibold">{assigned.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="mt-1 font-semibold">{active}</p>
                </div>
              </div>
            </Link>
          );
        })}
        {doctors.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            {query ? "No matching Drs" : "No Drs added yet"}
          </div>
        )}
      </div>
    </main>
  );
}
