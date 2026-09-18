import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackForm } from "@/components/feedback-form";
import { FeedbackHistory } from "@/components/feedback-history";
import { CompetencyRadar } from "@/components/competency-radar";
import { TrendBadge } from "@/components/trend-badge";
import { getPersonDossier, type FeedbackRecord } from "@/lib/feedbacks.functions";
import {
  PERIODS,
  buildTimeline,
  competencyStats,
  flattenScores,
  inPeriod,
  avg,
  monthlySeries,
  radarData,
  recurringPoints,
  trmDistribution,
} from "@/lib/feedbacks";
import { TRM_OPTIONS } from "@/lib/development";

export const Route = createFileRoute("/_authenticated/pessoa/$userId")({
  head: () => ({
    meta: [
      { title: "Evolução profissional — FP&A Hub" },
      { name: "description", content: "Feedbacks por competência, notas de entrega, tendências e evolução histórica do liderado." },
      { property: "og:title", content: "Evolução profissional — FP&A Hub" },
      { property: "og:description", content: "Feedbacks, competências e evidências de desenvolvimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonPage,
});

const fmtMonth = (m: string) => {
  const [y, mm] = m.split("-");
  return `${mm}/${y.slice(2)}`;
};

function PersonPage() {
  const { userId } = Route.useParams();
  const dossierFn = useServerFn(getPersonDossier);
  const [periodKey, setPeriodKey] = useState("180");
  const [competencyFilter, setCompetencyFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeedbackRecord | null>(null);

  const days = PERIODS.find((p) => p.key === periodKey)?.days ?? null;

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dossierQ = useQuery({
    queryKey: ["dossier", userId],
    queryFn: () => dossierFn({ data: { subjectId: userId } }),
    retry: false,
  });

  const name = profileQ.data?.full_name || profileQ.data?.email || "—";


  const d = dossierQ.data;
  const competencies = d?.competencies ?? [];
  const scale = d?.scaleLabels ?? [];
  const points = useMemo(() => flattenScores(d?.feedbacks ?? [], d?.deliveryRatings ?? []), [d]);
  const stats = useMemo(() => competencyStats(points, competencies, days), [points, competencies, days]);
  const series = useMemo(() => monthlySeries(points, competencyFilter), [points, competencyFilter]);
  const radar = useMemo(
    () => radarData(points, competencies, days, d?.jobLevel?.expectations),
    [points, competencies, days, d?.jobLevel],
  );
  const timeline = useMemo(
    () => buildTimeline(d?.feedbacks ?? [], d?.deliveryRatings ?? [], d?.tasks ?? [], competencies, scale, days),
    [d, competencies, scale, days],
  );

  const scopedPoints = inPeriod(points, days);
  const overallAvg = avg(scopedPoints.filter((p) => p.source === "feedback").map((p) => p.score));
  const deliveryAvg = avg(scopedPoints.filter((p) => p.source === "delivery").map((p) => p.score));
  const trm = trmDistribution(d?.tasks ?? [], days);
  const trmLabel = trm.predominant ? TRM_OPTIONS.find((o) => o.value === trm.predominant!.trm) : null;

  const evolving = stats.filter((s) => s.trend.kind === "up");
  const attention = stats.filter((s) => s.trend.kind === "down");
  const compName = (id: string) => competencies.find((c) => c.id === id)?.name ?? "—";

  const avgPeriod = (dd: number) => avg(inPeriod(points, dd).map((p) => p.score));

  if (dossierQ.isError) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Evolução profissional</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é restrita a gestores. {(dossierQ.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">
            Evolução profissional{d?.jobLevel ? ` · ${d.jobLevel.title}${d.jobLevel.level ? ` ${d.jobLevel.level}` : ""}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodKey} onValueChange={setPeriodKey}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo feedback
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">TRM predominante</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{trmLabel ? trmLabel.label.toUpperCase() : "—"}</div>
            <p className="text-xs text-muted-foreground">{trm.predominant ? `${trm.predominant.count} de ${trm.total} entregas` : "sem entregas classificadas"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Média dos feedbacks</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{overallAvg == null ? "—" : overallAvg.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">{scopedPoints.filter((p) => p.source === "feedback").length} notas no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Notas de entrega</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{deliveryAvg == null ? "—" : deliveryAvg.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">{scopedPoints.filter((p) => p.source === "delivery").length} tarefas avaliadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Médias por período</CardTitle></CardHeader>
          <CardContent className="space-y-0.5 text-xs">
            {[30, 90, 180, 365].map((dd) => (
              <div key={dd} className="flex justify-between">
                <span className="text-muted-foreground">{dd} dias</span>
                <span className="font-medium">{avgPeriod(dd)?.toFixed(1) ?? "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="evolucao">
        <TabsList>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
          <TabsTrigger value="timeline">Histórico de evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Nota atual por competência</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {competencies.filter((c) => c.is_active).map((c) => {
                const s = stats.find((x) => x.competencyId === c.id)!;
                return (
                  <div key={c.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{c.name}</span>
                      <span className="text-lg font-semibold">{s.current ?? "—"}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <TrendBadge trend={s.trend} />
                      <span className="text-[10px] text-muted-foreground">
                        {s.count} registro{s.count === 1 ? "" : "s"} · média {s.average?.toFixed(1) ?? "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Evolução histórica</CardTitle>
                <Select value={competencyFilter} onValueChange={setCompetencyFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Média geral</SelectItem>
                    {competencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="h-72">
                {series.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series.map((r) => ({ ...r, month: fmtMonth(r.month) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="feedback" name="Feedbacks" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="delivery" name="Notas de entrega" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" strokeWidth={2} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">Sem notas registradas.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Radar de competências</CardTitle></CardHeader>
              <CardContent>
                <CompetencyRadar data={radar} showExpected={!!d?.jobLevel} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Competências com maior evolução</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {evolving.length ? evolving.map((s) => <Badge key={s.competencyId} variant="secondary">{compName(s.competencyId)}</Badge>)
                  : <p className="text-sm text-muted-foreground">Dados insuficientes para calcular tendência.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Competências que precisam de desenvolvimento</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {attention.length ? attention.map((s) => <Badge key={s.competencyId} variant="outline">{compName(s.competencyId)}</Badge>)
                  : <p className="text-sm text-muted-foreground">Nada em atenção no período.</p>}
              </CardContent>
            </Card>
          </div>

          {d?.jobLevel && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Nível atual x expectativa do cargo</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="feedbacks" className="space-y-4">
          <FeedbackHistory
            feedbacks={d?.feedbacks ?? []}
            competencies={competencies}
            onEdit={(f) => { setEditing(f); setFormOpen(true); }}
          />
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Notas de entrega (por tarefa)</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {(d?.deliveryRatings ?? []).length ? (d?.deliveryRatings ?? []).map((r) => (
                <div key={r.task_id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1.5 last:border-0">
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <Badge variant="secondary" className="text-[10px]">nota de entrega {r.rating}</Badge>
                  <span className="text-xs text-muted-foreground">{r.date}</span>
                </div>
              )) : <p className="text-muted-foreground">Nenhuma tarefa avaliada ainda.</p>}
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
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de evolução</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {timeline.length ? timeline.map((i, idx) => (
                <div key={`${i.date}-${idx}`} className="flex gap-3 border-l pl-3 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{i.date.slice(8, 10)}/{i.date.slice(5, 7)}/{i.date.slice(0, 4)}</span>
                  <div className="min-w-0">
                    <div>{i.text}</div>
                    {i.detail && <div className="text-xs text-muted-foreground">{i.detail}</div>}
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">Sem eventos no período.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FeedbackForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        subjectId={userId}
        subjectName={name}
        competencies={competencies}
        scale={scale}
        editing={editing}
      />
    </div>
  );
}
