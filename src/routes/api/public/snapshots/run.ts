import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/snapshots/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { computeAndStoreSnapshots } = await import("@/lib/snapshots.server");
          const inserted = await computeAndStoreSnapshots(supabaseAdmin);
          return Response.json({ ok: true, inserted });
        } catch (e: any) {
          console.error("[snapshots/run]", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});