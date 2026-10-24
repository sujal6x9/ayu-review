import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const authUserOptions = {
  queryKey: ["auth-user"],
  staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },
};

export type Me = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async ({ client }): Promise<Me | null> => {
      const user = await client.fetchQuery(authUserOptions);
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.full_name || user.email || "User",
        roles: (roles ?? []).map((r) => r.role),
      };
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      }));
    },
  });
}
