import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";

export const Route = createFileRoute("/admin-login")({
  head: () => ({ meta: [
    { title: "Admin sign-in — Ayu Review" },
    { name: "description", content: "Administrator sign-in for managing review team accounts." },
    { property: "og:title", content: "Admin sign-in — Ayu Review" },
    { property: "og:description", content: "Access the separate administrator account management area." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <SignInForm admin />,
});
