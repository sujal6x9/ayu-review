import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanCreateReviewer } from "@/lib/accounts";

export const listSharedDoctors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: isUploader, error: uploaderError }, { data: isAdmin, error: adminError }] =
      await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "uploader" }),
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      ]);
    if (uploaderError || adminError) throw new Error("Unable to check Dr directory access.");
    assertCanCreateReviewer(isAdmin, isUploader);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("doctors").select("*").order("name");
    if (error) throw new Error("Unable to load the shared Dr directory.");
    return data;
  });
