import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, UserPlus, Users, UserCog } from "lucide-react";
import { listAccounts, createAccount, resetAccountPassword, changeAccountRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const accountOptions = { queryKey: ["admin-accounts"], queryFn: () => listAccounts() };
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Admin panel — Ayu Review" },
    { name: "description", content: "Manage Dr and paper creator accounts and passwords." },
    { property: "og:title", content: "Admin panel — Ayu Review" },
    { property: "og:description", content: "Administrator account management for the review team." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  component: AdminPage,
  errorComponent: () => <main className="mx-auto max-w-5xl p-8"><h1 className="text-2xl font-semibold text-primary">Admin panel unavailable</h1><p className="mt-3 text-muted-foreground">Only administrators can manage accounts. If you are an administrator, please refresh and try again.</p></main>,
});

function AdminPage() {
  const { data: accounts } = useSuspenseQuery(accountOptions);
  const create = useServerFn(createAccount);
  const reset = useServerFn(resetAccountPassword);
  const changeRole = useServerFn(changeAccountRole);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"reviewer" | "uploader">("reviewer");
  const [target, setTarget] = useState<(typeof accounts)[number] | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [roleTarget, setRoleTarget] = useState<(typeof accounts)[number] | null>(null);
  const [newRole, setNewRole] = useState<"reviewer" | "uploader">("reviewer");
  async function submitRole(e: React.FormEvent) {
    e.preventDefault(); if (!roleTarget) return; setBusy(true);
    try {
      await changeRole({ data: { userId: roleTarget.id, role: newRole } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-accounts"] }), qc.invalidateQueries({ queryKey: ["profiles"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
      toast.success("Role updated."); setRoleTarget(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to change role."); }
    finally { setBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const result = await create({ data: { email, fullName, password, role } });
      toast.success(`Account created: ${result.email}`);
      setEmail(""); setFullName(""); setPassword("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-accounts"] }), qc.invalidateQueries({ queryKey: ["profiles"] })]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create account."); }
    finally { setBusy(false); }
  }
  async function submitReset(e: React.FormEvent) {
    e.preventDefault(); if (!target) return; setBusy(true);
    try { await reset({ data: { userId: target.id, password: newPassword } }); toast.success("Password updated."); setTarget(null); setNewPassword(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to reset password."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
    <div className="mb-7 flex min-w-0 items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></span><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration</p><h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">Team & access</h1></div></div>
    <section className="rounded-3xl border border-border/70 bg-card/85 p-4 shadow-[0_24px_60px_-48px_rgba(15,65,75,.65)] backdrop-blur sm:p-7">
      <div className="mb-5"><h2 className="text-lg font-semibold">Create a team member</h2><p className="mt-1 text-sm text-muted-foreground">Set their sign-in details and starting role.</p></div>
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="full-name">Full name</Label><Input id="full-name" required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="new-email">Email</Label><Input id="new-email" type="email" required maxLength={254} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="account-password">Password</Label><Input id="account-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="account-role">Role</Label><Select value={role} onValueChange={(value) => { if (value === "reviewer" || value === "uploader") setRole(value); }}><SelectTrigger id="account-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reviewer">Dr</SelectItem><SelectItem value="uploader">Paper creator</SelectItem></SelectContent></Select></div>
        <Button disabled={busy} className="h-11 w-full sm:w-auto sm:justify-self-start"><UserPlus className="h-4 w-4" />{busy ? "Saving…" : "Create user"}</Button>
      </form>
    </section>
    <section className="pt-8"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Directory</p><h2 className="mt-1 text-xl font-semibold">Team members</h2></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{accounts.length}</span></div>
      <div className="grid gap-3 md:hidden">
        {accounts.map((a) => <article key={a.id} className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-bold text-secondary-foreground">{(a.full_name || a.email).slice(0, 1).toUpperCase()}</span><div className="min-w-0"><h3 className="truncate font-semibold">{a.full_name || "Unnamed user"}</h3><p className="mt-0.5 break-all text-xs text-muted-foreground">{a.email}</p></div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3"><span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{a.roles.map((r) => r === "uploader" ? "Paper creator" : r === "reviewer" ? "Dr" : "Admin").join(", ") || "Unassigned"}</span><div className="flex gap-2">{!a.roles.includes("admin") && <Button variant="outline" size="sm" disabled={busy} aria-label={`Change role for ${a.email}`} onClick={() => { setNewRole(a.roles.includes("uploader") ? "uploader" : "reviewer"); setRoleTarget(a); }}><UserCog className="h-4 w-4" /><span className="sr-only">Change role</span></Button>}<Button variant="outline" size="sm" onClick={() => { setNewPassword(""); setTarget(a); }}><KeyRound className="h-4 w-4" />Password</Button></div></div>
        </article>)}
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-sm md:block"><table className="admin-table w-full text-left text-sm"><thead className="border-b bg-muted/60 text-xs text-muted-foreground"><tr><th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Role</th><th className="py-3 text-right">Password</th></tr></thead><tbody>
        {accounts.map((a) => <tr key={a.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-accent/30"><td className="py-4 pr-4 font-medium">{a.full_name || "Unnamed user"}</td><td className="py-4 pr-4">{a.email}</td><td className="py-4 pr-4"><div className="flex flex-wrap items-center gap-3"><span>{a.roles.map((r) => r === "uploader" ? "Paper creator" : r === "reviewer" ? "Dr" : "Admin").join(", ") || "Unassigned"}</span>{!a.roles.includes("admin") && <Button variant="outline" size="sm" disabled={busy} aria-label={`Change role for ${a.email || a.full_name}`} onClick={() => { setNewRole(a.roles.includes("uploader") ? "uploader" : "reviewer"); setRoleTarget(a); }}><UserCog className="h-4 w-4" />Change role</Button>}</div></td><td className="py-4 text-right"><Button variant="outline" size="sm" onClick={() => { setNewPassword(""); setTarget(a); }}><KeyRound className="h-4 w-4" />Set password</Button></td></tr>)}
      </tbody></table></div>
    </section>
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) { setTarget(null); setNewPassword(""); } }}><DialogContent><DialogHeader><DialogTitle>Set password for {target?.email || target?.full_name}</DialogTitle></DialogHeader><form onSubmit={submitReset} className="space-y-4"><div className="space-y-2"><Label htmlFor="reset-account-password">New password</Label><Input id="reset-account-password" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div><Button disabled={busy}>Save password</Button></form></DialogContent></Dialog>
    <Dialog open={roleTarget !== null} onOpenChange={(open) => { if (!busy && !open) setRoleTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Change role for {roleTarget?.email || roleTarget?.full_name}</DialogTitle></DialogHeader><form onSubmit={submitRole} className="space-y-5"><div className="space-y-2"><Label htmlFor="change-role">Role</Label><Select value={newRole} disabled={busy} onValueChange={(value) => { if (value === "reviewer" || value === "uploader") setNewRole(value); }}><SelectTrigger id="change-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reviewer">Dr</SelectItem><SelectItem value="uploader">Paper creator</SelectItem></SelectContent></Select></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setRoleTarget(null)}>Cancel</Button><Button disabled={busy}><UserCog className="h-4 w-4" />{busy ? "Saving…" : "Save role"}</Button></div></form></DialogContent></Dialog>
  </main>;
}
