import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Password assistance — Question Paper Review Hub" },
    { name: "description", content: "Contact your administrator for password assistance." },
    { property: "og:title", content: "Password assistance — Question Paper Review Hub" },
    { property: "og:description", content: "Administrator-managed password assistance." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <main className="flex min-h-svh items-center justify-center bg-background p-6"><div className="w-full max-w-md space-y-5 border-t pt-8"><h1 className="font-display text-3xl font-semibold text-primary">Password assistance</h1><p className="text-muted-foreground">Contact your administrator to set a new password.</p><Button asChild className="h-11"><Link to="/auth">Back to sign in</Link></Button></div></main>,
});
