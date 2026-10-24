import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, FileCheck2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accountEmailSchema } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/review/$paperId")({
  validateSearch: (search: Record<string, unknown>) => ({ email: typeof search.email === "string" ? search.email : "" }),
  head: () => ({
    meta: [
      { title: "Open paper review — Ayu Review" },
      { name: "description", content: "Enter your reviewer credentials to open this protected paper." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewAccessPage,
});

function ReviewAccessPage() {
  const { paperId } = Route.useParams();
  const { email: sharedEmail } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(sharedEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const normalizedEmail = accountEmailSchema.parse(email);
      const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError || !auth.user) throw new Error("The email or review password is incorrect.");
      const { data: paper, error: paperError } = await supabase.from("papers").select("id,reviewer_id").eq("id", paperId).maybeSingle();
      if (paperError || !paper || paper.reviewer_id !== auth.user.id) {
        await supabase.auth.signOut();
        throw new Error("This review link is not assigned to that reviewer account.");
      }
      toast.success("Paper unlocked");
      navigate({ to: "/papers/$paperId", params: { paperId }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to unlock this paper.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,color-mix(in_oklch,var(--color-primary)_13%,transparent),transparent_35rem)]" />
    <section className="relative z-10 w-full max-w-md rounded-3xl border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-45px_rgba(15,65,75,.7)] backdrop-blur-xl sm:p-8">
      <Link to="/" className="mb-8 flex items-center gap-3 text-primary"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><FileCheck2 className="h-5 w-5" /></span><span className="font-display font-semibold">Ayu Review</span></Link>
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><LockKeyhole className="h-4 w-4" />Protected review</div>
      <h1 className="font-display text-3xl font-semibold">Open your paper</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the reviewer email and password provided by the paper creator.</p>
      <form onSubmit={unlock} className="mt-7 space-y-5">
        <div className="space-y-2"><Label htmlFor="review-email">Reviewer email</Label><Input id="review-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="review-password">Review password</Label><div className="relative"><Input id="review-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="pr-12" value={password} onChange={(event) => setPassword(event.target.value)} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
        <Button className="h-11 w-full" disabled={busy}>{busy ? "Opening…" : "Open review"}</Button>
      </form>
      <p className="mt-6 border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">This link opens only the paper assigned to your reviewer account.</p>
    </section>
  </main>;
}
