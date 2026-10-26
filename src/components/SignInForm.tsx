import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import {
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowUpRight,
  LoaderCircle,
  MessagesSquare,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { accountEmailSchema, accountHome } from "@/lib/accounts";
import { NATIVE_GOOGLE_CALLBACK, parseOAuthCallback } from "@/lib/google-auth";
import type { GoogleAccountFlow } from "@/lib/google-signup";
import { completeGoogleCreatorAccount } from "@/lib/signup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function homeForUser(userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Unable to load your account. Please try again.");
  const roles = (data ?? []).map((row) => row.role);
  if (roles.length === 0) {
    throw new Error("This Google account does not have access yet. Contact your administrator.");
  }
  return accountHome(roles);
}

const GOOGLE_FLOW_KEY = "ayu-review-google-flow";

function rememberGoogleFlow(flow: GoogleAccountFlow) {
  window.localStorage.setItem(GOOGLE_FLOW_KEY, flow);
}

function takeGoogleFlow(): GoogleAccountFlow | null {
  const flow = window.localStorage.getItem(GOOGLE_FLOW_KEY);
  window.localStorage.removeItem(GOOGLE_FLOW_KEY);
  return flow === "signup" || flow === "signin" ? flow : null;
}

export function SignInForm({ admin = false }: { admin?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState<GoogleAccountFlow | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (data.session) {
          const flow = takeGoogleFlow();
          if (flow) await completeGoogleCreatorAccount({ data: flow });
          const home = await homeForUser(data.session.user.id);
          if (!admin && home === "/admin") {
            throw new Error("Administrator accounts must use the separate admin sign-in page.");
          }
          if (admin && home !== "/admin") {
            throw new Error("Only the administrator can use the admin sign-in page.");
          }
          await navigate({ to: home, replace: true });
        }
      })
      .catch(async (error) => {
        await supabase.auth.signOut();
        toast.error(error instanceof Error ? error.message : "Unable to open your account.");
      });
  }, [admin, navigate]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let lastUrl = "";
    const completeNativeSignIn = async (url: string) => {
      if (!url || url === lastUrl) return;
      const callback = parseOAuthCallback(url);
      if (!callback) return;
      lastUrl = url;
      const flow = takeGoogleFlow();
      setGoogleBusy(flow ?? "signin");
      try {
        await Browser.close();
        if (callback.error) throw new Error(callback.error);
        if (!callback.accessToken || !callback.refreshToken) {
          throw new Error("Google did not return a valid session.");
        }
        const { data, error } = await supabase.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
        if (error || !data.user)
          throw new Error(error?.message || "Unable to sign in with Google.");
        if (!flow) throw new Error("Choose Google sign up or sign in and try again.");
        await completeGoogleCreatorAccount({ data: flow });
        await navigate({ to: await homeForUser(data.user.id), replace: true });
      } catch (error) {
        await supabase.auth.signOut();
        toast.error(error instanceof Error ? error.message : "Unable to sign in with Google.");
      } finally {
        if (!disposed) setGoogleBusy(null);
      }
    };
    let listener: Awaited<ReturnType<typeof App.addListener>> | undefined;
    void App.addListener("appUrlOpen", ({ url }) => completeNativeSignIn(url)).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    });
    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) void completeNativeSignIn(launch.url);
    });
    return () => {
      disposed = true;
      if (listener) void listener.remove();
    };
  }, [navigate]);
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: accountEmailSchema.parse(email),
        password,
      });
      if (error || !data.user) throw new Error("Email or password is incorrect.");
      const home = await homeForUser(data.user.id);
      if (!admin && home === "/admin") {
        await supabase.auth.signOut();
        throw new Error("Administrator accounts must use the separate admin sign-in page.");
      }
      if (admin && home !== "/admin") {
        await supabase.auth.signOut();
        throw new Error("Only the administrator can use the admin sign-in page.");
      }
      setPassword("");
      await navigate({ to: home });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function continueWithGoogle(flow: GoogleAccountFlow) {
    setGoogleBusy(flow);
    rememberGoogleFlow(flow);
    try {
      const native = Capacitor.isNativePlatform();
      const redirectTo = native ? NATIVE_GOOGLE_CALLBACK : `${window.location.origin}/auth`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: native },
      });
      if (error) throw error;
      if (native) {
        if (!data.url) throw new Error("Google sign-in could not be opened.");
        await Browser.open({ url: data.url, presentationStyle: "popover" });
      }
    } catch (error) {
      takeGoogleFlow();
      toast.error(error instanceof Error ? error.message : "Unable to start Google sign-in.");
      setGoogleBusy(null);
    }
  }
  const Icon = admin ? ShieldCheck : FileCheck2;
  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <header className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-8 lg:px-12">
        <Link to="/" className="flex min-w-0 items-center gap-3 text-primary">
          <img
            src="/ayu-scholar-mark.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 shrink-0 object-contain drop-shadow-sm"
          />
          <span className="truncate font-display font-semibold">
            Ayu Review
            <span className="ml-3 hidden border-l border-border pl-3 font-sans text-sm font-normal text-muted-foreground sm:inline">
              Paper review workspace
            </span>
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
          <Link to={admin ? "/auth" : "/admin-login"}>
            {admin ? "User sign in" : "Admin"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>
      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-72px)] max-w-7xl items-center gap-10 px-4 pb-8 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:px-12">
        <section className="hidden max-w-2xl lg:block">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/70 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />A calmer way to review every paper
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.08] tracking-tight text-foreground xl:text-6xl">
            Review together.
            <br />
            <span className="text-primary">Publish with confidence.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Bring PDF and Excel question papers, feedback, corrections and approvals into one
            focused workspace.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/70 bg-card/65 p-5 shadow-sm backdrop-blur">
              <ScanSearch className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Precise review</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Mark pages, cells and exact areas.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/65 p-5 shadow-sm backdrop-blur">
              <MessagesSquare className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Live collaboration</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Discuss and resolve every issue.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/70 bg-card/90 p-5 shadow-[0_30px_80px_-45px_rgba(15,65,75,.7)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Icon className="h-4 w-4" />
            {admin ? "Administration" : "Secure workspace"}
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
            {admin ? "Admin sign in" : creatingAccount ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mb-8 mt-2 text-sm leading-6 text-muted-foreground">
            {admin
              ? "Manage your review team and account access."
              : creatingAccount
                ? "Use a verified Gmail address to create your paper-creator workspace."
                : "Sign in to continue to your paper-creator workspace."}
          </p>
          <form onSubmit={signIn} className="space-y-5" aria-busy={busy}>
            {!admin && (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full gap-3 bg-background"
                disabled={busy || googleBusy !== null}
                onClick={() => continueWithGoogle(creatingAccount ? "signup" : "signin")}
              >
                {googleBusy !== null ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <GoogleMark />
                )}
                {googleBusy !== null
                  ? "Opening Google…"
                  : creatingAccount
                    ? "Sign up with Google"
                    : "Sign in with Google"}
              </Button>
            )}
            {!admin && !creatingAccount && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or use email
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            {(admin || !creatingAccount) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      className="pr-12"
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  className="h-12 w-full justify-between px-5"
                  disabled={busy || googleBusy !== null}
                >
                  {busy ? "Signing in…" : "Sign in securely"}
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </form>
          {!admin && (
            <div className="mt-7 border-t border-border/70 pt-5 text-center text-sm text-muted-foreground">
              {creatingAccount ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                className="font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => setCreatingAccount((value) => !value)}
              >
                {creatingAccount ? "Sign in" : "Create one"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4a4.7 4.7 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4L15.4 17c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.4H3A10 10 0 0 0 2 12c0 1.6.4 3.2 1 4.6l3.4-2.7Z"
      />
      <path
        fill="#EA4335"
        d="M12 6c1.5 0 2.9.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.7A6 6 0 0 1 12 6Z"
      />
    </svg>
  );
}
