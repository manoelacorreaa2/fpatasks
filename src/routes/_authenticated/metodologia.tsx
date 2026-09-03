import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TRM_MATRIX, LEVEL_IS_PER_TASK_NOTE } from "@/lib/development";

export const Route = createFileRoute("/_authenticated/metodologia")({
  head: () => ({
    meta: [
      { title: "Metodologia — TRM e estilo de liderança | FP&A Hub" },
      {
        name: "description",
        content: "Como funcionam os níveis D1–D4 de maturidade, os estilos S1–S4 de liderança e as faixas de delegação usadas nas tarefas.",
      },
      { property: "og:title", content: "Metodologia — TRM e estilo de liderança" },
      { property: "og:description", content: "Níveis D1–D4, estilos S1–S4 e faixas de delegação usados nas tarefas do FP&A Hub." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Metodologia</h1>
        <p className="text-sm text-muted-foreground">
          Como leio maturidade (TRM), escolho o estilo de liderança e defino o nível de delegação em cada tarefa.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nível de maturidade × estilo de liderança</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Nível</th>
                  <th className="px-4 py-2 font-medium">Competência</th>
                  <th className="px-4 py-2 font-medium">Comprometimento</th>
                  <th className="px-4 py-2 font-medium">Estilo</th>
                  <th className="px-4 py-2 font-medium">O que você faz</th>
                </tr>
              </thead>
              <tbody>
                {TRM_MATRIX.map((r) => (
                  <tr key={r.trm} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{r.level}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.competence}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.commitment}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary">{r.styleLabel}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2">
        {TRM_MATRIX.map((r) => (
          <Card key={r.trm}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{r.level}</span>
                <Badge>{r.styleLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <div>
                Competência <span className="text-foreground">{r.competence}</span> · comprometimento{" "}
                <span className="text-foreground">{r.commitment}</span>
              </div>
              <div className="text-foreground">{r.action}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-primary" />
            Por que o estilo muda de pessoa para pessoa na mesma task
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{LEVEL_IS_PER_TASK_NOTE}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nível de delegação (1–7)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-1">
            <li>
              <b>1–2</b> — o gestor decide e comunica.
            </li>
            <li>
              <b>3–4</b> — decisão compartilhada: propõe, discutimos, seguimos.
            </li>
            <li>
              <b>5–7</b> — o liderado decide e informa o resultado.
            </li>
          </ul>
          <p className="text-muted-foreground">
            O nível deve subir com o tempo na mesma rotina — é assim que a autonomia aparece nos números da aba
            Desenvolvimento.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Definition of Done e pós-task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground">Definition of Done</span> — critérios objetivos combinados antes de começar.
            Se o DoD está claro, eu preciso instruir menos durante a execução.
          </p>
          <p>
            <span className="text-foreground">Pós-task</span> — ao concluir, registramos retrabalho, intervenção do gestor
            e autonomia percebida. Não é avaliação: é o dado que mostra quando o nível pode subir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
