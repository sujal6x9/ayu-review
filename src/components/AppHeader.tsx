import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileCheck2, LogOut, Upload, ShieldCheck, LayoutDashboard, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const adminArea = useRouterState({ select: (state) => state.location.pathname === "/admin" });
  const canUpload = me?.roles.includes("uploader") || me?.roles.includes("admin");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: adminArea ? "/admin-login" : "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:flex sm:px-6 lg:px-8">
        <Link to={adminArea ? "/admin" : "/dashboard"} className="flex min-w-0 items-center gap-3 text-primary">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">{adminArea ? <ShieldCheck className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}</span>
          <span className="min-w-0"><span className="block truncate font-display text-lg font-semibold">Review Hub</span><span className="block text-[11px] text-muted-foreground">{adminArea ? "Administration" : "Question paper workspace"}</span></span>
        </Link>
        <div className="flex shrink-0 items-center gap-3 sm:order-last sm:ml-auto">
          {me && <div className="hidden max-w-44 min-w-0 border-l pl-4 text-right leading-tight md:block"><div className="truncate text-sm font-medium">{me.name}</div><div className="mt-1 text-xs capitalize text-muted-foreground">{me.roles.map((r) => r === "uploader" ? "Paper creator" : r).join(", ")}</div></div>}
          <Button variant="ghost" size="icon" className="shrink-0" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
        <nav className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 border-t pt-3 text-sm sm:ml-4 sm:border-t-0 sm:pt-0">
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><LayoutDashboard className="h-4 w-4" />{adminArea ? "User workspace" : "Dashboard"}</Link></Button>
          {!adminArea && me?.roles.includes("admin") && <Button asChild variant="outline" size="sm"><Link to="/admin"><ShieldCheck className="h-4 w-4" />Admin area<ArrowUpRight className="h-3 w-3" /></Link></Button>}
          {!adminArea && canUpload && <Button asChild size="sm"><Link to="/upload"><Upload className="h-4 w-4" />Upload paper</Link></Button>}
        </nav>
      </div>
    </header>
  );
}
