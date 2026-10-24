import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, changeRoleSchema, createAccountSchema, editableAccountRole, resetAccountSchema, usernameEmail } from "@/lib/accounts";

export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error) throw new Error("Unable to check account permissions.");
    assertAdmin(allowed);
    const [{ data: profiles, error: pError }, { data: roles, error: rError }] = await Promise.all([
      context.supabase.from("profiles").select("id, username, full_name, created_at").order("created_at", { ascending: false }),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pError || rError) throw new Error("Unable to load accounts.");
    return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createAccountSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error) throw new Error("Unable to check account permissions.");
    assertAdmin(allowed);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: usernameEmail(data.username), password: data.password, email_confirm: true,
      user_metadata: { full_name: data.fullName }, app_metadata: { managed_account: true, username: data.username },
    });
    if (createError) throw new Error(createError.message);
    const user = created.user;
    if (!user) throw new Error("The account could not be created.");
    const [{ error: profileError }, { error: roleError }] = await Promise.all([
      supabaseAdmin.from("profiles").update({ username: data.username, full_name: data.fullName }).eq("id", user.id),
      supabaseAdmin.from("user_roles").insert({ user_id: user.id, role: data.role }),
    ]);
    if (profileError || roleError) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      throw new Error("Unable to save the account; no account was retained. Try another username.");
    }
    return { username: data.username };
  });

export const resetAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetAccountSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error) throw new Error("Unable to check account permissions.");
    assertAdmin(allowed);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (updateError) throw new Error(updateError.message);
    return { success: true };
  });

export const changeAccountRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => changeRoleSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error) throw new Error("Unable to check account permissions.");
    assertAdmin(allowed);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: readError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (readError) throw new Error("Unable to load the current role.");
    const currentRole = editableAccountRole((roles ?? []).map((row) => row.role));
    const { data: updated, error: updateError } = await supabaseAdmin.from("user_roles")
      .update({ role: data.role }).eq("user_id", data.userId).eq("role", currentRole).select("role").single();
    if (updateError || !updated) throw new Error("The role could not be changed. Refresh and try again.");
    return { role: updated.role };
  });