import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, ArrowRight, ShieldCheck, Eye, EyeOff, ArrowUpRight, LoaderCircle, MessagesSquare, ScanSearch, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { accountEmailSchema, accountHome } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function homeForUser(userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Unable to load your account. Please try again.");
  return accountHome((data ?? []).map((row) => row.role));
}

export function SignInForm({ admin = false }: { admin?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await navigate({ to: await homeForUser(data.session.user.id), replace: true });
    }).catch(() => {});
  }, [navigate]);
  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: accountEmailSchema.parse(email), password });
      if (error || !data.user) throw new Error("Email or password is incorrect.");
      const home = await homeForUser(data.user.id);
      setPassword("");
      await navigate({ to: home });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  const Icon = admin ? ShieldCheck : FileCheck2;
  return <main className="relative min-h-svh overflow-hidden bg-background">
    <header className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-8 lg:px-12">
      <Link to="/" className="flex min-w-0 items-center gap-3 text-primary"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><FileCheck2 className="h-5 w-5" /></span><span className="truncate font-display font-semibold">Ayu Review<span className="ml-3 hidden border-l border-border pl-3 font-sans text-sm font-normal text-muted-foreground sm:inline">Paper review workspace</span></span></Link>
      <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground"><Link to={admin ? "/auth" : "/admin-login"}>{admin ? "User sign in" : "Admin"}<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>
    </header>
    <div className="relative z-10 mx-auto grid min-h-[calc(100svh-72px)] max-w-7xl items-center gap-10 px-4 pb-8 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:px-12">
      <section className="hidden max-w-2xl lg:block">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/70 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur"><Sparkles className="h-3.5 w-3.5" />A calmer way to review every paper</div>
        <h1 className="font-display text-5xl font-semibold leading-[1.08] tracking-tight text-foreground xl:text-6xl">Review together.<br /><span className="text-primary">Publish with confidence.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">Bring PDF and Excel question papers, feedback, corrections and approvals into one focused workspace.</p>
        <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/70 bg-card/65 p-5 shadow-sm backdrop-blur"><ScanSearch className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">Precise review</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Mark pages, cells and exact areas.</p></div>
          <div className="rounded-2xl border border-border/70 bg-card/65 p-5 shadow-sm backdrop-blur"><MessagesSquare className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">Live collaboration</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Discuss and resolve every issue.</p></div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/70 bg-card/90 p-5 shadow-[0_30px_80px_-45px_rgba(15,65,75,.7)] backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Icon className="h-4 w-4" />{admin ? "Administration" : "Secure workspace"}</div>
        <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">{admin ? "Admin sign in" : "Welcome back"}</h2>
        <p className="mb-8 mt-2 text-sm leading-6 text-muted-foreground">{admin ? "Manage your review team and account access." : "Sign in to continue reviewing your papers."}</p>
        <form onSubmit={signIn} className="space-y-5" aria-busy={busy}>
          <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" placeholder="you@example.com" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" className="pr-12" placeholder="Enter your password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9 text-muted-foreground" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
          <Button className="h-12 w-full justify-between px-5" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}</Button>
        </form>
        {!admin && <p className="mt-7 border-t border-border/70 pt-5 text-xs leading-relaxed text-muted-foreground">Need access or a new password? <span className="font-semibold text-foreground">Contact your administrator.</span></p>}
      </section>
    </div>
  </main>;
}
