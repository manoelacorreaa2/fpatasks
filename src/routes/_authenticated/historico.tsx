import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fmtUSD, fmtDateLong, initials } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/historico")({
  component: HistoricoPage,
});

type Row = Database["public"]["Views"]["tasks_with_score"]["Row"];
type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email">;

const recurrenceLabel: Record<string, string> = {
  one_off: "Esporádica",
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

function HistoricoPage() {
  const [group, setGroup] = useState<"week" | "month">("week");
  const [assignee, setAssignee] = useState<string>("all");

  const profilesQ = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const doneQ = useQuery({
    queryKey: ["done_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks_with_score")
        .select("*")
        .eq("status", "done")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    (profilesQ.data ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [profilesQ.data]);

  const rows = useMemo(() => {
    const all = doneQ.data ?? [];
    return assignee === "all" ? all : all.filter((r) => r.assignee_id === assignee);
  }, [doneQ.data, assignee]);

  const buckets = useMemo(() => groupBy(rows, group), [rows, group]);

  const totalImpact = rows.reduce((s, r) => s + impactOf(r), 0);

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de entregas</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} tarefas concluídas • {fmtUSD(totalImpact)} de impacto entregue
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Pessoa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pessoas</SelectItem>
              {(profilesQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={group} onValueChange={(v) => setGroup(v as "week" | "month")}>
            <TabsList>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {doneQ.isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
      {!doneQ.isLoading && buckets.length === 0 && (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma tarefa concluída ainda.
        </div>
      )}

      <div className="space-y-6">
        {buckets.map((b) => {
          const sum = b.items.reduce((s, r) => s + impactOf(r), 0);
          return (
            <section key={b.key} className="rounded-lg border bg-card/30">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{b.label}</div>
                  <div className="text-xs text-muted-foreground">{b.items.length} entregas</div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{fmtUSD(sum)}</div>
              </div>
              <ul className="divide-y">
                {b.items.map((r) => {
                  const p = r.assignee_id ? profileById.get(r.assignee_id) : null;
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials(p?.full_name || p?.email || "??")}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{p?.full_name || p?.email || "—"}</span>
                          <span>•</span>
                          <span>{fmtDateLong(r.completed_at)}</span>
                          {r.recurrence && r.recurrence !== "one_off" && (
                            <>
                              <span>•</span>
                              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                                {recurrenceLabel[r.recurrence] ?? r.recurrence}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{fmtUSD(impactOf(r))}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.actual_impact_usd != null ? "real" : "estimado"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function impactOf(r: Row): number {
  return Number(r.actual_impact_usd ?? r.estimated_impact_usd ?? 0);
}

function groupBy(rows: Row[], mode: "week" | "month") {
  const map = new Map<string, { key: string; label: string; items: Row[]; sort: number }>();
  for (const r of rows) {
    if (!r.completed_at) continue;
    const d = new Date(r.completed_at);
    let key: string;
    let label: string;
    let sort: number;
    if (mode === "month") {
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      sort = d.getFullYear() * 12 + d.getMonth();
    } else {
      const monday = startOfWeek(d);
      key = monday.toISOString().slice(0, 10);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      label = `Semana de ${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${sunday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
      sort = monday.getTime();
    }
    if (!map.has(key)) map.set(key, { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [], sort });
    map.get(key)!.items.push(r);
  }
  return [...map.values()].sort((a, b) => b.sort - a.sort);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // make Monday start
  x.setDate(x.getDate() + diff);
  return x;
}