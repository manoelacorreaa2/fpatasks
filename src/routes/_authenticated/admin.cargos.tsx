import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleRow } from "@/components/toggle-row";
import { listCompetencies, listJobLevels, saveJobLevel, setProfileJobLevel } from "@/lib/feedbacks.functions";
import { SCALE_FALLBACK } from "@/lib/feedbacks";

export const Route = createFileRoute("/_authenticated/admin/cargos")({
  head: () => ({
    meta: [
      { title: "Cargos e expectativas — FP&A Hub" },
      { name: "description", content: "Cadastro de cargos, nível e nota esperada por competência, e associação das pessoas ao cargo." },
      { property: "og:title", content: "Cargos e expectativas — FP&A Hub" },
      { property: "og:description", content: "Expectativa por competência para comparação descritiva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobLevelsAdmin,
});

const NO_LEVEL = "__none__";

function JobLevelsAdmin() {
  const qc = useQueryClient();
  const compsFn = useServerFn(listCompetencies);
  const levelsFn = useServerFn(listJobLevels);
  const saveFn = useServerFn(saveJobLevel);
  const assignFn = useServerFn(setProfileJobLevel);

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expect, setExpect] = useState<Record<string, number>>({});

  const compsQ = useQuery({ queryKey: ["competencies"], queryFn: () => compsFn(), retry: false });
  const levelsQ = useQuery({ queryKey: ["job_levels"], queryFn: () => levelsFn(), retry: false });
  const peopleQ = useQuery({
    queryKey: ["profiles_job_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, job_level_id")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Informe o cargo");
      await saveFn({
        data: {
          ...(editingId ? { id: editingId } : {}),
          title: title.trim(),
          level: level.trim() || null,
          expectations: Object.entries(expect).map(([competency_id, expected_score]) => ({ competency_id, expected_score })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Cargo salvo");
      setTitle("");
      setLevel("");
      setEditingId(null);
      setExpect({});
      qc.invalidateQueries({ queryKey: ["job_levels"] });
      qc.invalidateQueries({ queryKey: ["dossier"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: (v: { profileId: string; jobLevelId: string | null }) => assignFn({ data: v }),
    onSuccess: () => {
      toast.success("Cargo associado");
      qc.invalidateQueries({ queryKey: ["profiles_job_levels"] });
      qc.invalidateQueries({ queryKey: ["dossier"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (compsQ.isError || levelsQ.isError) {
    const err = (compsQ.error ?? levelsQ.error) as Error | null;
    return <div className="p-6 text-sm text-muted-foreground">Área restrita a gestores. {err?.message}</div>;
  }

  const comps = (compsQ.data ?? []).filter((c) => c.is_active);
  const levels = levelsQ.data ?? [];
  const compName = (id: string) => (compsQ.data ?? []).find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Cargos e expectativas</h1>
        <p className="text-sm text-muted-foreground">A comparação é descritiva: mostra atual, esperado e a diferença.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{editingId ? "Editar cargo" : "Novo cargo"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Cargo (ex.: Analista de FP&A)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Nível (ex.: Pleno)" value={level} onChange={(e) => setLevel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Nota esperada por competência — {SCALE_FALLBACK.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(" · ")}
            </p>
            {comps.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                <span className="text-sm">{c.name}</span>
                <ToggleRow
                  options={SCALE_FALLBACK.map((s) => ({ value: s.value, label: String(s.value) }))}
                  value={expect[c.id] ?? null}
                  onChange={(v) =>
                    setExpect((s) => {
                      const next = { ...s };
                      if (v == null) delete next[c.id];
                      else next[c.id] = v as number;
                      return next;
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button variant="ghost" onClick={() => { setEditingId(null); setTitle(""); setLevel(""); setExpect({}); }}>
                Cancelar
              </Button>
            )}
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Salvar cargo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cargos cadastrados</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {levels.length ? levels.map((j) => (
            <div key={j.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{j.title}{j.level ? ` — ${j.level}` : ""}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(j.id);
                    setTitle(j.title);
                    setLevel(j.level ?? "");
                    setExpect(Object.fromEntries(j.expectations.map((e) => [e.competency_id, e.expected_score])));
                  }}
                >
                  Editar
                </Button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {j.expectations.length
                  ? j.expectations.map((e) => `${compName(e.competency_id)} ${e.expected_score}`).join(" · ")
                  : "sem expectativas definidas"}
              </div>
            </div>
          )) : <p className="text-muted-foreground">Nenhum cargo cadastrado.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Pessoas x cargo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(peopleQ.data ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <span className="text-sm">{p.full_name || p.email}</span>
              <Select
                value={(p as any).job_level_id ?? NO_LEVEL}
                onValueChange={(v) => assign.mutate({ profileId: p.id, jobLevelId: v === NO_LEVEL ? null : v })}
              >
                <SelectTrigger className="w-56"><SelectValue placeholder="Sem cargo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LEVEL}>Sem cargo</SelectItem>
                  {levels.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.title}{j.level ? ` — ${j.level}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
