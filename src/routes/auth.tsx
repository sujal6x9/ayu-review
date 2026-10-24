import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Email sign-in — Ayu Review" },
    { name: "description", content: "Sign in with your administrator-issued email and password." },
    { property: "og:title", content: "Email sign-in — Ayu Review" },
    { property: "og:description", content: "Access your assigned question paper reviews." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: () => <SignInForm />,
});
