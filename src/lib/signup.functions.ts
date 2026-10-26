import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { googleCreatorProfile } from "@/lib/google-signup";

export const ensureGoogleCreatorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRoles, error: roleReadError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleReadError) throw new Error("Unable to prepare your workspace account.");
    if ((existingRoles ?? []).length > 0) return { created: false };

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (error || !data.user) throw new Error("Unable to verify your Google account.");

    const user = data.user;
    const profile = googleCreatorProfile({
      email: user.email,
      emailConfirmedAt: user.email_confirmed_at,
      providers: Array.isArray(user.app_metadata?.providers)
        ? user.app_metadata.providers.filter(
            (provider): provider is string => typeof provider === "string",
          )
        : user.app_metadata?.provider
          ? [String(user.app_metadata.provider)]
          : [],
      fullName:
        typeof user.user_metadata?.["full_name"] === "string"
          ? user.user_metadata["full_name"]
          : typeof user.user_metadata?.["name"] === "string"
            ? user.user_metadata["name"]
            : null,
    });

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: user.id, email: profile.email, full_name: profile.fullName },
        { onConflict: "id" },
      );
    if (profileError) throw new Error("Unable to save your workspace profile.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: user.id, role: "uploader" });
    if (roleError && roleError.code !== "23505") {
      throw new Error("Unable to activate your paper-creator account.");
    }

    return { created: true };
  });
