import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fmtUSD, fmtPct, fmtDate, initials, daysUntil } from "@/lib/format";
import { accuracyPct } from "@/lib/scoring";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { AlertTriangle, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/overview")({
  component: Overview,
});

function Overview() {
  const tasksQ = useQuery({
    queryKey: ["tasks_with_score"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks_with_score")
        .select("*")
        .order("score", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const snapshotsQ = useQuery({
    queryKey: ["snapshots_team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_snapshots")
        .select("*")
        .eq("scope", "team")
        .order("snapshot_date", { ascending: true })
        .limit(26);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasks = tasksQ.data ?? [];
  const profiles = profilesQ.data ?? [];
  const profileById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const total = tasks.length;
  const byStatus = { todo: 0, doing: 0, done: 0 };
  let overdue = 0;
  let marginCount = 0;
  let estimated = 0;
  let actual = 0;
  for (const t of tasks) {
    byStatus[t.status as keyof typeof byStatus]++;
    if (t.is_overdue) overdue++;
    if (t.impacts_margin) marginCount++;
    estimated += Number(t.estimated_impact_usd ?? 0);
    actual += Number(t.actual_impact_usd ?? 0);
  }
  const gap = actual - estimated;
  const marginPct = total > 0 ? (marginCount / total) * 100 : 0;

  const topTasks = tasks.slice(0, 8);
  const critical = tasks.filter(
    (t) => (t.urgency === "high" || t.urgency === "critical") && t.status !== "done",
  ).slice(0, 6);

  const perPerson = profiles
    .map((p) => {
      const own = tasks.filter((t) => t.assignee_id === p.id);
      const est = own.reduce((s, t) => s + Number(t.estimated_impact_usd ?? 0), 0);
      const act = own.reduce((s, t) => s + Number(t.actual_impact_usd ?? 0), 0);
      const accs = own
        .map((t) => accuracyPct(Number(t.estimated_impact_usd ?? 0), t.actual_impact_usd == null ? null : Number(t.actual_impact_usd)))
        .filter((v): v is number => v != null);
      const acc = accs.length ? accs.reduce((s, n) => s + n, 0) / accs.length : null;
      return { id: p.id, name: p.full_name || p.email, est, act, acc, count: own.length };
    })
    .sort((a, b) => b.act - a.act);

  const trendData = (snapshotsQ.data ?? []).map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    estimated: Number(s.estimated_impact_usd),
    actual: Number(s.actual_impact_usd),
  }));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada da equipe FP&A</p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Tarefas totais" value={total} icon={<TrendingUp className="h-4 w-4" />} sub={`${byStatus.doing} fazendo • ${byStatus.todo} a fazer`} />
        <KPI label="Concluídas" value={byStatus.done} icon={<CheckCircle2 className="h-4 w-4" />} sub={`${total ? Math.round((byStatus.done / total) * 100) : 0}% do total`} />
        <KPI label="Atrasadas" value={overdue} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} sub={`${fmtPct(marginPct, 0)} impactam margem`} highlight={overdue > 0} />
        <KPI label="Impacto real" value={fmtUSD(actual)} icon={<Clock className="h-4 w-4" />} sub={`Estimado ${fmtUSD(estimated)} • gap ${fmtUSD(gap)}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tendência semanal (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Sem snapshots ainda. O cron semanal vai popular este gráfico, ou rode manualmente em Admin → Membros.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="estimated" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="Estimado" />
                  <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} name="Real" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impacto por pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            {perPerson.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Adicione membros e tarefas para ver o ranking.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={perPerson} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="est" fill="hsl(var(--muted-foreground))" name="Estimado" />
                  <Bar dataKey="act" fill="hsl(var(--primary))" name="Real" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top tarefas por score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem tarefas ainda.</p>
            ) : (
              topTasks.map((t) => {
                const aid = t.assignee_id ?? "";
                const owner = profileById[aid];
                return (
                  <Link
                    key={t.id}
                    to="/tasks/$userId"
                    params={{ userId: aid }}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {owner?.full_name ?? "—"} • {fmtUSD(Number(t.estimated_impact_usd))} • {fmtDate(t.deadline)}
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-3 tabular-nums">{Number(t.score).toFixed(2)}</Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Críticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {critical.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa crítica aberta. 🎉</p>
            ) : (
              critical.map((t) => {
                const aid = t.assignee_id ?? "";
                const d = daysUntil(t.deadline);
                return (
                  <Link
                    key={t.id}
                    to="/tasks/$userId"
                    params={{ userId: aid }}
                    className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {profileById[aid]?.full_name ?? "—"} • {t.urgency}
                        {d != null && (d < 0 ? ` • ${Math.abs(d)}d atrasada` : d <= 7 ? ` • em ${d}d` : "")}
                      </div>
                    </div>
                    <Badge variant="destructive" className="ml-3">{t.urgency}</Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Ranking por pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {perPerson.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</div>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials(p.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Link to="/tasks/$userId" params={{ userId: p.id }} className="font-medium hover:underline">{p.name}</Link>
                    <div className="text-xs text-muted-foreground">{p.count} tarefas • acurácia {fmtPct(p.acc, 0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{fmtUSD(p.act)}</div>
                    <div className="text-xs text-muted-foreground">est {fmtUSD(p.est)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KPI({ label, value, sub, icon, highlight }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}