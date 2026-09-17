import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RadarRow } from "@/lib/feedbacks";

export function CompetencyRadar({ data, showExpected = false }: { data: RadarRow[]; showExpected?: boolean }) {
  const hasAny = data.some((d) => d.atual != null || d.anterior != null);
  if (!hasAny) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem notas registradas neste período.</p>;
  }
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="competency" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          />
          <Radar name="Período anterior" dataKey="anterior" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.12} />
          <Radar name="Atual" dataKey="atual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
          {showExpected && (
            <Radar name="Esperado" dataKey="esperado" stroke="hsl(var(--chart-3, var(--primary)))" fill="none" strokeDasharray="4 3" />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
