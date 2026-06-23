import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SnapshotResult { ok: boolean; inserted?: number; error?: string }

export const runSnapshotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SnapshotResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false, error: "Apenas administradores." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeAndStoreSnapshots } = await import("@/lib/snapshots.server");
    const inserted = await computeAndStoreSnapshots(supabaseAdmin);
    return { ok: true, inserted };
  });