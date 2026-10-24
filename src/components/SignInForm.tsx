import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, ArrowRight, ShieldCheck, Eye, EyeOff, ArrowUpRight, LoaderCircle } from "lucide-react";
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
  return <main className="flex min-h-svh flex-col bg-background">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-4 sm:px-10">
      <Link to="/" className="flex min-w-0 items-center gap-3 text-primary"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><FileCheck2 className="h-5 w-5" /></span><span className="truncate font-semibold">Review Hub<span className="ml-3 hidden border-l pl-3 text-sm font-normal text-muted-foreground sm:inline">प्रश्नपत्र समीक्षा</span></span></Link>
      <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground"><Link to={admin ? "/auth" : "/admin-login"}>{admin ? "User sign in" : "Admin sign in"}<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>
    </header>
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{admin ? "Administration" : "Question Paper Review Hub"}</div>
      <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{admin ? "Admin sign in" : "Welcome back."}</h1>
      <p className="mb-8 mt-2 text-sm text-muted-foreground">{admin ? "Sign in to your admin account." : "Sign in to your review workspace."}</p>
      <form onSubmit={signIn} className="space-y-5" aria-busy={busy}>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" className="h-11 bg-background shadow-none" placeholder="Enter your email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" className="h-11 bg-background pr-12 shadow-none" placeholder="Enter your password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-0.5 h-10 w-10 text-muted-foreground" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
        <Button className="h-11 w-full justify-between px-4 shadow-none" disabled={busy}>{busy ? "Signing in…" : "Sign in"}{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}</Button>
      </form>
      {!admin && <p className="mt-7 border-t pt-5 text-xs leading-relaxed text-muted-foreground">Need an account or a new password?<br /><span className="font-medium text-foreground">Contact your administrator.</span></p>}
    </div>
    <footer className="px-6 py-5 text-center text-xs text-muted-foreground">प्रश्नपत्र समीक्षा · Question Paper Review Hub</footer>
  </main>;
}
