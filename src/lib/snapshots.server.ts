import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

function accuracy(estimated: number, actual: number): number {
  if (!estimated || estimated <= 0) return 0;
  const acc = 1 - Math.abs(actual - estimated) / Math.max(estimated, 1);
  return Math.max(0, Math.min(1, acc)) * 100;
}

export async function computeAndStoreSnapshots(admin: Admin): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks, error: tErr } = await admin.from("tasks").select("*");
  if (tErr) throw tErr;
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id")
    .eq("is_active", true);
  if (pErr) throw pErr;

  const todayDate = new Date(today);

  const rowFor = (subset: typeof tasks, scope: "team" | "user", userId: string | null) => {
    const total = subset.length;
    let todo = 0, doing = 0, done = 0, overdue = 0, margin = 0;
    let est = 0, act = 0;
    let accSum = 0, accCount = 0;
    for (const t of subset) {
      if (t.status === "todo") todo++;
      else if (t.status === "doing") doing++;
      else if (t.status === "done") done++;
      if (t.impacts_margin) margin++;
      if (t.deadline && new Date(t.deadline) < todayDate && t.status !== "done") overdue++;
      const e = Number(t.estimated_impact_usd ?? 0);
      const a = t.actual_impact_usd == null ? null : Number(t.actual_impact_usd);
      est += e;
      if (a != null) {
        act += a;
        if (t.status === "done") {
          accSum += accuracy(e, a);
          accCount++;
        }
      }
    }
    return {
      snapshot_date: today,
      scope,
      user_id: userId,
      total_tasks: total,
      todo_count: todo,
      doing_count: doing,
      done_count: done,
      overdue_count: overdue,
      margin_impact_pct: total ? (margin / total) * 100 : 0,
      estimated_impact_usd: est,
      actual_impact_usd: act,
      gap_usd: act - est,
      accuracy_pct: accCount ? accSum / accCount : 0,
    };
  };

  const rows = [
    rowFor(tasks ?? [], "team", null),
    ...(profiles ?? []).map((p) => rowFor((tasks ?? []).filter((t) => t.assignee_id === p.id), "user", p.id)),
  ];

  const { error } = await admin.from("kpi_snapshots").upsert(rows, { onConflict: "snapshot_date,scope,user_id" });
  if (error) throw error;
  return rows.length;
}