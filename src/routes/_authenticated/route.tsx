import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authUserOptions } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(authUserOptions);
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <Outlet />
    </div>
  ),
});
