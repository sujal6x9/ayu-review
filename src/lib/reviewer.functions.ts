import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanCreateReviewer, createReviewerSchema } from "@/lib/accounts";

export const createReviewerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createReviewerSchema.parse(input))
  .handler(async ({ context, data }) => {
    const [{ data: isAdmin, error: adminError }, { data: isUploader, error: uploaderError }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "uploader" }),
    ]);
    if (adminError || uploaderError) throw new Error("Unable to check reviewer-management permissions.");
    assertCanCreateReviewer(isAdmin, isUploader);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const account = {
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
      app_metadata: { managed_account: true, created_by: context.userId },
    };
    let { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser(account);
    if (createError && /failed to fetch|network|connection/i.test(createError.message)) {
      const lookup = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const recovered = lookup.data?.users.find((candidate) =>
        candidate.email?.toLowerCase() === data.email &&
        candidate.app_metadata?.managed_account === true &&
        candidate.app_metadata?.created_by === context.userId,
      );
      if (recovered) {
        created = { user: recovered };
        createError = null;
      } else if (!lookup.error) {
        ({ data: created, error: createError } = await supabaseAdmin.auth.admin.createUser(account));
      }
    }
    if (createError) throw new Error(createError.message);
    const user = created.user;
    if (!user) throw new Error("The reviewer account could not be created.");

    const [{ error: profileError }, { error: roleError }] = await Promise.all([
      supabaseAdmin.from("profiles").update({ email: data.email, full_name: data.fullName }).eq("id", user.id),
      supabaseAdmin.from("user_roles").insert({ user_id: user.id, role: "reviewer" }),
    ]);
    if (profileError || roleError) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      throw new Error("Unable to save the reviewer; no account was retained. Try another email address.");
    }
    return { id: user.id, email: data.email, fullName: data.fullName };
  });
