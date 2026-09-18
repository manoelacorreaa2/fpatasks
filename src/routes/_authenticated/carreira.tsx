import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompetencyRadar } from "@/components/competency-radar";
import { TrendBadge } from "@/components/trend-badge";
import { getPersonDossier } from "@/lib/feedbacks.functions";
import {
  PERIODS,
  avg,
  competencyStats,
  flattenScores,
  inPeriod,
  radarData,
  recurringPoints,
  trmDistribution,
} from "@/lib/feedbacks";
import { TRM_OPTIONS } from "@/lib/development";
import { fmtUSD } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/carreira")({
  head: () => ({
    meta: [
      { title: "Evolução de carreira — FP&A Hub" },
      { name: "description", content: "Visão consolidada de maturidade, feedbacks, competências e entregas por período." },
      { property: "og:title", content: "Evolução de carreira — FP&A Hub" },
      { property: "og:description", content: "Evidências registradas de desenvolvimento profissional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CareerPage,
});

function CareerPage() {
  const dossierFn = useServerFn(getPersonDossier);
  const [userId, setUserId] = useState<string>("");
  const [periodKey, setPeriodKey] = useState("365");
  const days = PERIODS.find((p) => p.key === periodKey)?.days ?? null;

  const peopleQ = useQuery({
    queryKey: ["profiles_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = peopleQ.data ?? [];
  const selected = userId || people[0]?.id || "";

  const dossierQ = useQuery({
    queryKey: ["dossier", selected],
    enabled: !!selected,
    queryFn: () => dossierFn({ data: { subjectId: selected } }),
    retry: false,
  });

  const d = dossierQ.data;
  const competencies = d?.competencies ?? [];
  const points = useMemo(() => flattenScores(d?.feedbacks ?? [], d?.deliveryRatings ?? []), [d]);
  const stats = useMemo(() => competencyStats(points, competencies, days), [points, competencies, days]);
  const radar = useMemo(
    () => radarData(points, competencies, days, d?.jobLevel?.expectations),
    [points, competencies, days, d?.jobLevel],
  );

  const compName = (id: string) => competencies.find((c) => c.id === id)?.name ?? "—";
  const avgOf = (dd: number | null) => avg(inPeriod(points, dd).map((p) => p.score));
  const trm = trmDistribution(d?.tasks ?? [], days);
  const trmLabel = trm.predominant ? TRM_OPTIONS.find((o) => o.value === trm.predominant!.trm)?.label : null;

  const scopedTasks = (d?.tasks ?? []).filter(
    (t) => t.completed_at && (days == null || t.completed_at.slice(0, 10) >= new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)),
  );
  const topDeliveries = [...scopedTasks]
    .sort((a, b) => (b.actual_impact_usd ?? b.estimated_impact_usd ?? 0) - (a.actual_impact_usd ?? a.estimated_impact_usd ?? 0))
    .slice(0, 8);
  const delegations = scopedTasks.map((t) => t.delegation_level).filter((n): n is number => n != null);

  const personName = people.find((p) => p.id === selected)?.full_name || people.find((p) => p.id === selected)?.email || "—";

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Evolução de carreira</h1>
          <p className="text-sm text-muted-foreground">Evidências consolidadas — sem classificação automática de promoção.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setUserId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Pessoa" /></SelectTrigger>
            <SelectContent>
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periodKey} onValueChange={setPeriodKey}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected && (
            <Button variant="outline" asChild>
              <Link to="/pessoa/$userId" params={{ userId: selected }}>
                Ver perfil <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {dossierQ.isError ? (
        <p className="text-sm text-muted-foreground">Esta área é restrita a gestores. {(dossierQ.error as Error).message}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric title="TRM predominante" value={trmLabel ? trmLabel.toUpperCase() : "—"} hint={`${trm.total} entregas classificadas`} />
            <Metric
              title="Delegação média"
              value={delegations.length ? (delegations.reduce((a, b) => a + b, 0) / delegations.length).toFixed(1) : "—"}
              hint={`${delegations.length} tarefas com nível`}
            />
            <Metric title="Média geral (período)" value={avgOf(days)?.toFixed(1) ?? "—"} hint={`${inPeriod(points, days).length} notas`} />
            <Metric
              title="Últimos 6 x 12 meses"
              value={`${avgOf(180)?.toFixed(1) ?? "—"} → ${avgOf(365)?.toFixed(1) ?? "—"}`}
              hint="média 6m x média 12m"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Competências — {personName}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {stats.filter((s) => s.count > 0).length ? (
                  stats
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <div key={s.competencyId} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                        <span className="min-w-0 flex-1 truncate">{compName(s.competencyId)}</span>
                        <span className="tabular-nums">{s.current ?? "—"}</span>
                        <TrendBadge trend={s.trend} />
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground">Nenhuma nota registrada no período.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Radar (atual x período anterior)</CardTitle></CardHeader>
              <CardContent><CompetencyRadar data={radar} showExpected={!!d?.jobLevel} /></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Principais entregas do período</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {topDeliveries.length ? topDeliveries.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1.5 last:border-0">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.trm && <Badge variant="secondary" className="text-[10px]">{t.trm.toUpperCase()}</Badge>}
                  <span className="text-xs text-muted-foreground">{fmtUSD(Number(t.actual_impact_usd ?? t.estimated_impact_usd ?? 0))}</span>
                </div>
              )) : <p className="text-muted-foreground">Sem entregas concluídas no período.</p>}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pontos fortes recorrentes</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {recurringPoints(d?.feedbacks ?? [], "strengths").map((t) => <div key={t}>· {t}</div>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pontos de desenvolvimento recorrentes</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {recurringPoints(d?.feedbacks ?? [], "development_points").map((t) => <div key={t}>· {t}</div>)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Nível atual x expectativa do cargo</CardTitle></CardHeader>
            <CardContent>
              {d?.jobLevel ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {d.jobLevel.expectations.map((e) => {
                    const s = stats.find((x) => x.competencyId === e.competency_id);
                    const diff = s?.current == null ? null : s.current - e.expected_score;
                    return (
                      <div key={e.competency_id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{compName(e.competency_id)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          atual {s?.current ?? "—"} · esperado {e.expected_score}
                          {diff != null && ` · dif ${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Cargo não cadastrado para esta pessoa.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Evidências registradas</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(d?.feedbacks ?? []).filter((f) => f.evidence).length ? (
                (d?.feedbacks ?? [])
                  .filter((f) => f.evidence)
                  .map((f) => (
                    <div key={f.id} className="border-b pb-2 last:border-0">
                      <div className="text-xs text-muted-foreground">
                        {f.feedback_date}{f.author_name ? ` · ${f.author_name}` : ""}
                      </div>
                      <div>{f.evidence}</div>
                    </div>
                  ))
              ) : (
                <p className="text-muted-foreground">Nenhuma evidência registrada.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
