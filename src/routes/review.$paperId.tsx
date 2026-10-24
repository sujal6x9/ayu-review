import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/review/$paperId")({
  head: () => ({
    meta: [
      { title: "Open paper review — Ayu Review" },
      { name: "description", content: "Enter the shared password to open this paper." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewAccessPage,
});

function ReviewAccessPage() {
  const { paperId: shareToken } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      let { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session && !sessionData.session.user.is_anonymous) {
        throw new Error(
          "Open this Dr link in a private browser window, or sign out of Ayu Review first.",
        );
      }
      if (!sessionData.session) {
        const { data, error } = await supabase.auth.signInAnonymously({
          options: { data: { full_name: "Guest Dr" } },
        });
        if (error || !data.user)
          throw new Error(error?.message || "Could not start the protected review session.");
        sessionData = { session: data.session };
      }
      const { data: unlockedPaperId, error } = await supabase.rpc("unlock_paper_share", {
        _token: shareToken,
        _password: password,
      });
      if (error || !unlockedPaperId) throw new Error("The review link or password is incorrect.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth-user"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ]);
      toast.success("Paper unlocked");
      navigate({ to: "/papers/$paperId", params: { paperId: unlockedPaperId }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to unlock this paper.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,color-mix(in_oklch,var(--color-primary)_13%,transparent),transparent_35rem)]" />
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-45px_rgba(15,65,75,.7)] backdrop-blur-xl sm:p-8">
        <Link to="/" className="mb-8 flex items-center gap-3 text-primary">
          <img
            src="/ayu-scholar-mark.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 shrink-0 object-contain drop-shadow-sm"
          />
          <span className="font-display font-semibold">Ayu Review</span>
        </Link>
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <LockKeyhole className="h-4 w-4" />
          Protected review
        </div>
        <h1 className="font-display text-3xl font-semibold">Open your paper</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Enter the password shared by the paper creator. No account or email is required.
        </p>
        <form onSubmit={unlock} className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="review-password">Review password</Label>
            <div className="relative">
              <Input
                id="review-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                autoFocus
                className="pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-9 w-9"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button className="h-11 w-full" disabled={busy}>
            {busy ? "Opening…" : "Open review"}
          </Button>
        </form>
        <p className="mt-6 border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">
          This protected link opens only its assigned paper.
        </p>
      </section>
    </main>
  );
}
