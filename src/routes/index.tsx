import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ayu Review — Collaborative paper review" },
      {
        name: "description",
        content: "Upload PDF or Excel question papers, review them together with live comments and markings, and approve them.",
      },
      { property: "og:title", content: "Ayu Review" },
      { property: "og:description", content: "Two-way, real-time review and approval of question papers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SignInForm />,
});
