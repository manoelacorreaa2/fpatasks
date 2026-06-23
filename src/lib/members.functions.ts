import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(120),
});

export interface InviteResult { ok: boolean; userId?: string; error?: string }

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const { data: isAdmin, error: rErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (rErr) return { ok: false, error: rErr.message };
    if (!isAdmin) return { ok: false, error: "Apenas administradores podem convidar membros." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, userId: invited.user?.id };
  });

const setActiveSchema = z.object({ userId: z.string().uuid(), active: z.boolean() });

export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setActiveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false, error: "Apenas administradores." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });