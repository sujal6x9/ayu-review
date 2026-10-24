import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Username sign-in — Question Paper Review Hub" },
    { name: "description", content: "Sign in with your administrator-issued username and password." },
    { property: "og:title", content: "Username sign-in — Question Paper Review Hub" },
    { property: "og:description", content: "Access your assigned question paper reviews." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: () => <SignInForm />,
});
