import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtPct } from "@/lib/format";
import { TRM_OPTIONS, devStats, devSuggestions, delegationHint, type Trm } from "@/lib/development";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/desenvolvimento")({
  head: () => ({
    meta: [
      { title: "Desenvolvimento do time — FP&A Hub" },
      { name: "description", content: "Maturidade (TRM), delegação, retrabalho e autonomia por pessoa no time de FP&A." },
      { property: "og:title", content: "Desenvolvimento do time — FP&A Hub" },
      { property: "og:description", content: "Maturidade (TRM), delegação, retrabalho e autonomia por pessoa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevelopmentPage,
});

const PERIODS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "all", label: "Tudo" },
];

function DevelopmentPage() {
  const [person, setPerson] = useState<string>("all");
  const [period, setPeriod] = useState<string>("90");

  const profilesQ = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks_with_score"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks_with_score").select("*").order("score", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profiles = profilesQ.data ?? [];
  const nameOf = (id: string | null) =>
    profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || "—";

  const tasks = useMemo(() => {
    let list = tasksQ.data ?? [];
    if (person !== "all") list = list.filter((t) => t.assignee_id === person);
    if (period !== "all") {
      const cutoff = Date.now() - Number(period) * 86400000;
      list = list.filter((t) => {
        const ref = t.completed_at ?? t.created_at;
        return ref ? new Date(ref).getTime() >= cutoff : true;
      });
    }
    return list;
  }, [tasksQ.data, person, period]);

  const stats = devStats(tasks);
  const suggestions = devSuggestions(tasks);
  const trmData = TRM_OPTIONS.map((o) => ({ name: `${o.label} · ${o.hint}`, total: stats.trmDist[o.value] }));

  const recentDone = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime())
    .slice(0, 12);

  const perPerson = profiles.map((p) => {
    const s = devStats(tasks.filter((t) => t.assignee_id === p.id));
    return { id: p.id, name: p.full_name || p.email, ...s };
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Desenvolvimento</h1>
          <p className="text-sm text-muted-foreground">Maturidade, delegação e autonomia — o sistema apenas sugere, você decide.</p>
        </div>
        <div className="flex gap-2">
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Time inteiro</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      {suggestions.length > 0 && (
        <div className="space-y-1 rounded-lg border border-primary/30 bg-primary/5 p-4">
          {suggestions.map((s) => (
            <div key={s} className="flex gap-2 text-sm">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><b>Sugestão — você decide:</b> {s}</span>
            </div>
          ))}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Média de delegação" value={stats.avgDelegation == null ? "—" : stats.avgDelegation.toFixed(1)} sub={delegationHint(stats.avgDelegation == null ? null : Math.round(stats.avgDelegation))} />
        <Stat label="Taxa de retrabalho" value={fmtPct(stats.reworkRate, 0)} sub={`${stats.done} concluídas no período`} />
        <Stat label="Intervenção do gestor" value={fmtPct(stats.interventionRate, 0)} sub="das entregas com registro" />
        <Stat label="Autonomia percebida" value={stats.avgAutonomy == null ? "—" : `${stats.avgAutonomy.toFixed(1)}/5`} sub="média das entregas" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Distribuição de TRM</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trmData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" name="Tarefas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Por pessoa</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {perPerson.map((p) => (
              <div key={p.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.done} concluídas</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>delegação {p.avgDelegation == null ? "—" : p.avgDelegation.toFixed(1)}</span>
                  <span>retrabalho {fmtPct(p.reworkRate, 0)}</span>
                  <span>intervenção {fmtPct(p.interventionRate, 0)}</span>
                  <span>autonomia {p.avgAutonomy == null ? "—" : `${p.avgAutonomy.toFixed(1)}/5`}</span>
                  <span>
                    TRM {(Object.keys(p.trmDist) as Trm[]).filter((k) => p.trmDist[k] > 0).map((k) => `${k.toUpperCase()}:${p.trmDist[k]}`).join(" ") || "—"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Entregas recentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentDone.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrega concluída no período.</p>
          ) : (
            recentDone.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {nameOf(t.assignee_id)} • {fmtDate(t.completed_at)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.trm && <Badge variant="outline" className="uppercase">{t.trm}</Badge>}
                  {t.leadership_style && <Badge variant="outline" className="uppercase">{t.leadership_style}</Badge>}
                  {t.delegation_level != null && <Badge variant="secondary">del {t.delegation_level}</Badge>}
                  {t.rework && <Badge variant="destructive">retrabalho</Badge>}
                  {t.manager_intervention && <Badge variant="destructive">intervenção</Badge>}
                  {t.perceived_autonomy != null && <Badge variant="outline">autonomia {t.perceived_autonomy}/5</Badge>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
