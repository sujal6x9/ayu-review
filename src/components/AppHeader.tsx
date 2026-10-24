import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileCheck2, LogOut, Upload, ShieldCheck, LayoutDashboard, ArrowUpRight, Stethoscope } from "lucide-react";
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
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 shadow-[0_8px_30px_-26px_rgba(15,45,55,.65)] backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 sm:flex sm:px-6 lg:px-8">
        <Link to={adminArea ? "/admin" : "/dashboard"} className="flex min-w-0 items-center gap-3 text-primary">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">{adminArea ? <ShieldCheck className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}</span>
          <span className="min-w-0"><span className="block truncate font-display text-base font-semibold sm:text-lg">Ayu Review</span><span className="hidden text-[11px] text-muted-foreground sm:block">{adminArea ? "Administration" : "Question paper workspace"}</span></span>
        </Link>
        <div className="flex shrink-0 items-center gap-3 sm:order-last sm:ml-auto">
          {me && <div className="hidden max-w-44 min-w-0 border-l pl-4 text-right leading-tight md:block"><div className="truncate text-sm font-medium">{me.name}</div><div className="mt-1 text-xs capitalize text-muted-foreground">{me.roles.map((r) => r === "uploader" ? "Paper creator" : r === "reviewer" ? "Dr" : r).join(", ")}</div></div>}
          <Button variant="ghost" size="icon" className="shrink-0" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
        <nav className="col-span-2 -mx-1 mt-3 flex min-w-0 items-center gap-1 overflow-x-auto border-t border-border/60 px-1 pt-3 text-sm [scrollbar-width:none] sm:ml-4 sm:mt-0 sm:border-t-0 sm:pt-0 [&::-webkit-scrollbar]:hidden">
          <Button asChild variant="ghost" size="sm" className="shrink-0"><Link to="/dashboard"><LayoutDashboard className="h-4 w-4" />{adminArea ? "Workspace" : "Dashboard"}</Link></Button>
          {!adminArea && canUpload && <Button asChild variant="ghost" size="sm" className="shrink-0"><Link to="/reviewers"><Stethoscope className="h-4 w-4" />Drs</Link></Button>}
          {!adminArea && me?.roles.includes("admin") && <Button asChild variant="outline" size="sm" className="shrink-0"><Link to="/admin"><ShieldCheck className="h-4 w-4" />Admin<ArrowUpRight className="h-3 w-3" /></Link></Button>}
          {!adminArea && canUpload && <Button asChild size="sm" className="shrink-0"><Link to="/upload"><Upload className="h-4 w-4" />Upload</Link></Button>}
        </nav>
      </div>
    </header>
  );
}
