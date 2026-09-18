import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { listCompetencies, saveCompetency } from "@/lib/feedbacks.functions";
import { SCALE_FALLBACK } from "@/lib/feedbacks";

export const Route = createFileRoute("/_authenticated/admin/competencias")({
  head: () => ({
    meta: [
      { title: "Competências — FP&A Hub" },
      { name: "description", content: "Cadastro de competências avaliadas nos feedbacks: criar, renomear, reordenar e desativar." },
      { property: "og:title", content: "Competências — FP&A Hub" },
      { property: "og:description", content: "Configuração dos critérios de avaliação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompetenciesAdmin,
});

function CompetenciesAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCompetencies);
  const saveFn = useServerFn(saveCompetency);
  const [newName, setNewName] = useState("");

  const q = useQuery({ queryKey: ["competencies"], queryFn: () => listFn(), retry: false });

  const save = useMutation({
    mutationFn: (data: { id?: string; name: string; sort_order?: number; is_active?: boolean }) => saveFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competencies"] });
      qc.invalidateQueries({ queryKey: ["dossier"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isError) {
    return <div className="p-6 text-sm text-muted-foreground">Área restrita a gestores. {(q.error as Error).message}</div>;
  }

  const list = q.data ?? [];

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Competências</h1>
        <p className="text-sm text-muted-foreground">Desativar nunca apaga notas antigas — o histórico continua nos gráficos.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <Input
                className="h-8 w-16"
                type="number"
                defaultValue={c.sort_order}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== c.sort_order) save.mutate({ id: c.id, name: c.name, sort_order: v });
                }}
              />
              <Input
                className="h-8 min-w-48 flex-1"
                defaultValue={c.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) save.mutate({ id: c.id, name: v });
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{c.is_active ? "ativa" : "inativa"}</span>
                <Switch checked={c.is_active} onCheckedChange={(v) => save.mutate({ id: c.id, name: c.name, is_active: v })} />
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input placeholder="Nova competência…" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9" />
            <Button
              disabled={!newName.trim() || save.isPending}
              onClick={() => {
                save.mutate({ name: newName.trim(), sort_order: (list.at(-1)?.sort_order ?? 0) + 1 });
                setNewName("");
              }}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1">Adicionar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Escala de notas</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {SCALE_FALLBACK.map((s) => (
            <div key={s.value} className="flex gap-3 border-b py-1 last:border-0">
              <span className="w-5 font-medium">{s.value}</span>
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
