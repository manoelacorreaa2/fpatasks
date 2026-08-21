import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lightbulb, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { computeScore, type Urgency } from "@/lib/scoring";
import { fmtUSD } from "@/lib/format";
import { requestReview } from "@/lib/tasks.functions";
import { ToggleRow } from "@/components/toggle-row";
import {
  DELEGATION_LEVELS,
  STYLE_OPTIONS,
  TRM_OPTIONS,
  TRM_TO_STYLE,
  delegationHint,
  devSuggestions,
  newDodItem,
  parseDod,
  suggestDod,
  type DodItem,
  type Style,
  type Trm,
} from "@/lib/development";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email">;

interface Props {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  assigneeId: string;
  currentUserId: string;
  profiles: Profile[];
  isAdmin?: boolean;
  /** Valores iniciais (ex.: criação a partir de um modelo). */
  initial?: Partial<TaskInsert> | null;
}

const empty = (assigneeId: string, currentUserId: string): TaskInsert => ({
  assignee_id: assigneeId,
  created_by: currentUserId,
  title: "",
  description: "",
  status: "todo",
  urgency: "medium",
  deadline: null,
  impacts_margin: false,
  estimated_hours: 4,
  expected_output: "",
  impact_type: "revenue",
  estimated_impact_usd: 0,
  actual_impact_usd: null,
  confidence: 3,
  needs_review: false,
  reviewer_id: null,
  review_status: "pending",
  is_blocked: false,
  blocked_reason: "",
  recurrence: "one_off",
  trm: null,
  leadership_style: null,
  leadership_style_manual: false,
  delegation_level: null,
  dod: [],
  rework: null,
  manager_intervention: null,
  perceived_autonomy: null,
});

export function TaskModal({ open, onClose, task, assigneeId, currentUserId, profiles, isAdmin = false, initial = null }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TaskInsert>(() => empty(assigneeId, currentUserId));
  const [newCriterion, setNewCriterion] = useState("");
  const [showDev, setShowDev] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const requestReviewFn = useServerFn(requestReview);

  useEffect(() => {
    if (task) {
      setForm({ ...task });
    } else {
      setForm({ ...empty(assigneeId, currentUserId), ...(initial ?? {}) });
    }
    setShowDev(false);
  }, [task, assigneeId, currentUserId, open, initial]);

  /** Tarefa do próprio gestor: não faz sentido pedir maturidade/delegação/pós-task. */
  const isManagerOwnTask = isAdmin && form.assignee_id === currentUserId;
  const devVisible = !isManagerOwnTask || showDev;

  const set = <K extends keyof TaskInsert>(k: K, v: TaskInsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const dod = useMemo(() => parseDod(form.dod), [form.dod]);
  const setDod = (items: DodItem[]) => set("dod", items as unknown as TaskInsert["dod"]);

  const historyQ = useQuery({
    queryKey: ["dev_history", form.assignee_id],
    enabled: open && !!form.assignee_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, trm, delegation_level, rework, manager_intervention, perceived_autonomy, completed_at, dod, recurrence")
        .eq("assignee_id", form.assignee_id)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const history = historyQ.data ?? [];
  const suggestions = useMemo(
    () => devSuggestions(history.filter((t) => t.id !== task?.id), form.trm as Trm | null),
    [history, form.trm, task?.id],
  );

  const previousDod = useMemo(() => {
    if (!form.recurrence || form.recurrence === "one_off") return null;
    const prev = history.find(
      (t) => t.id !== task?.id && t.status === "done" && t.title === form.title && parseDod(t.dod).length > 0,
    );
    return prev ? parseDod(prev.dod).map((i) => ({ ...i, done: false })) : null;
  }, [history, form.recurrence, form.title, task?.id]);

  const pickTrm = (v: Trm | null) => {
    setForm((f) => ({
      ...f,
      trm: v,
      leadership_style: f.leadership_style_manual ? f.leadership_style : v ? TRM_TO_STYLE[v] : null,
    }));
  };

  const score = computeScore({
    impacts_margin: !!form.impacts_margin,
    estimated_impact_usd: Number(form.estimated_impact_usd ?? 0),
    confidence: Number(form.confidence ?? 3),
    estimated_hours: form.estimated_hours == null ? null : Number(form.estimated_hours),
    urgency: (form.urgency as Urgency) ?? "medium",
    deadline: form.deadline ?? null,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title?.trim()) throw new Error("Título obrigatório");
      if (form.needs_review && !form.reviewer_id) throw new Error("Selecione um revisor");
      if (form.status === "done" && devVisible) {
        if (form.rework == null) throw new Error("Pós-task: informe se houve retrabalho");
        if (form.manager_intervention == null) throw new Error("Pós-task: informe se houve intervenção do gestor");
        if (form.perceived_autonomy == null) throw new Error("Pós-task: informe a autonomia percebida");
      }
      if (task) {
        const { id, score, is_overdue, position, s_reach, s_impact_norm, s_confidence_n, s_effort, s_urgency_mult, s_deadline_mult, dod_total, dod_done, created_at, updated_at, completed_at, ...updatable } = form as any;
        const { error } = await supabase.from("tasks").update(updatable).eq("id", task.id);
        if (error) throw error;
      } else {
        const { id, score, is_overdue, position, s_reach, s_impact_norm, s_confidence_n, s_effort, s_urgency_mult, s_deadline_mult, dod_total, dod_done, created_at, updated_at, completed_at, ...insertable } = form as any;
        const { error } = await supabase.from("tasks").insert(insertable);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      qc.invalidateQueries({ queryKey: ["tasks_with_score"] });
      qc.invalidateQueries({ queryKey: ["tasks_by_assignee"] });
      qc.invalidateQueries({ queryKey: ["dev_history"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa removida");
      qc.invalidateQueries({ queryKey: ["tasks_with_score"] });
      qc.invalidateQueries({ queryKey: ["tasks_by_assignee"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendReview = useMutation({
    mutationFn: async (force: boolean) => {
      if (!task) throw new Error("Salve a tarefa antes");
      return await requestReviewFn({ data: { taskId: task.id, force } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Email de revisão enviado ✓");
        qc.invalidateQueries({ queryKey: ["tasks_with_score"] });
        qc.invalidateQueries({ queryKey: ["tasks_by_assignee"] });
        qc.invalidateQueries({ queryKey: ["email_logs", task?.id] });
      } else if (res.dedup) {
        const ok = confirm(`Email já enviado há ${res.minutesAgo} min. Reenviar mesmo assim?`);
        if (ok) sendReview.mutate(true);
      } else {
        toast.error(res.error ?? "Falha ao enviar");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const name = templateName.trim() || form.title?.trim();
      if (!name) throw new Error("Dê um nome ao modelo");
      const { error } = await supabase.from("task_templates").insert({
        owner_id: currentUserId,
        name,
        title: form.title ?? "",
        description: form.description ?? null,
        urgency: (form.urgency as any) ?? "medium",
        recurrence: (form.recurrence as any) ?? "one_off",
        impacts_margin: !!form.impacts_margin,
        impact_type: (form.impact_type as any) ?? null,
        estimated_impact_usd: Number(form.estimated_impact_usd ?? 0),
        estimated_hours: form.estimated_hours == null ? null : Number(form.estimated_hours),
        confidence: Number(form.confidence ?? 3),
        expected_output: form.expected_output ?? null,
        needs_review: !!form.needs_review,
        trm: (form.trm as any) ?? null,
        delegation_level: form.delegation_level ?? null,
        dod: (form.dod ?? []) as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo salvo");
      setTemplateName("");
      qc.invalidateQueries({ queryKey: ["task_templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{task ? "Editar tarefa" : "Nova tarefa"}</span>
            <span className="text-sm font-normal text-muted-foreground">Score: <b className="tabular-nums">{score.toFixed(2)}</b></span>
          </DialogTitle>
        </DialogHeader>

        <Section title="Operacional">
          <Field label="Título" full>
            <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Descrição" full>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={form.status as string} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="doing">Fazendo</SelectItem>
                <SelectItem value="done">Feito</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Urgência">
            <Select value={form.urgency as string} onValueChange={(v) => set("urgency", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Deadline">
            <Input type="date" value={form.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} />
          </Field>
          <Field label="Recorrência">
            <Select value={(form.recurrence as string) ?? "one_off"} onValueChange={(v) => set("recurrence", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one_off">Esporádica</SelectItem>
                <SelectItem value="daily">Diária</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={form.assignee_id} onValueChange={(v) => set("assignee_id", v)} disabled={!isAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
            {!isAdmin && <p className="mt-1 text-[10px] text-muted-foreground">Apenas admins podem reatribuir.</p>}
          </Field>
        </Section>

        <Section title="Estratégico">
          <Field label="Impacta margem">
            <div className="flex h-9 items-center"><Switch checked={!!form.impacts_margin} onCheckedChange={(v) => set("impacts_margin", v)} /></div>
          </Field>
          <Field label="Tipo de impacto">
            <Select value={(form.impact_type as string) ?? "revenue"} onValueChange={(v) => set("impact_type", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Receita</SelectItem>
                <SelectItem value="cost_reduction">Redução de custo</SelectItem>
                <SelectItem value="margin_pct">Margem (%)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Impacto estimado (USD)">
            <Input type="number" min={0} step={100} value={Number(form.estimated_impact_usd ?? 0)} onChange={(e) => set("estimated_impact_usd", Number(e.target.value))} />
          </Field>
          <Field label="Impacto real (USD)">
            <Input type="number" min={0} step={100} value={form.actual_impact_usd == null ? "" : Number(form.actual_impact_usd)} onChange={(e) => set("actual_impact_usd", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" />
          </Field>
          <Field label="Horas estimadas">
            <Input type="number" min={0.5} step={0.5} value={form.estimated_hours ?? ""} onChange={(e) => set("estimated_hours", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label={`Confiança: ${form.confidence}/5`}>
            <div className="pt-2"><Slider min={1} max={5} step={1} value={[Number(form.confidence ?? 3)]} onValueChange={([v]) => set("confidence", v)} /></div>
          </Field>
          <Field label="Output esperado" full>
            <Input value={form.expected_output ?? ""} onChange={(e) => set("expected_output", e.target.value)} placeholder="Ex: relatório consolidado, dashboard atualizado…" />
          </Field>
        </Section>

        <Section title="Desenvolvimento">
          {suggestions.length > 0 && devVisible && (
            <div className="col-span-2 space-y-1 rounded-md border border-primary/30 bg-primary/5 p-3">
              {suggestions.map((s) => (
                <div key={s} className="flex gap-2 text-xs text-foreground">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    <b>Sugestão — você decide:</b> {s}
                  </span>
                </div>
              ))}
            </div>
          )}
          {isManagerOwnTask && (
            <div className="col-span-2 flex items-center justify-between rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <span>Tarefa sua — maturidade e delegação não se aplicam.</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowDev((v) => !v)}>
                {showDev ? "esconder campos de delegação" : "mostrar campos de delegação"}
              </Button>
            </div>
          )}
          {devVisible && (
            <>
              <Field label="TRM (maturidade)">
                <ToggleRow options={TRM_OPTIONS} value={(form.trm as Trm) ?? null} onChange={pickTrm} />
                <p className="mt-1 text-[10px] text-muted-foreground">D1 iniciante · D2 aprendiz · D3 capaz · D4 autônomo</p>
              </Field>
              <Field label="Estilo de liderança">
                <ToggleRow
                  options={STYLE_OPTIONS}
                  value={(form.leadership_style as Style) ?? null}
                  onChange={(v) => setForm((f) => ({ ...f, leadership_style: v, leadership_style_manual: v != null }))}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {form.leadership_style_manual ? "Definido manualmente." : "Sugerido pelo TRM — clique para editar."}
                </p>
              </Field>
              <Field label="Nível de delegação" full>
                <ToggleRow
                  options={DELEGATION_LEVELS.map((n) => ({ value: n, label: String(n) }))}
                  value={form.delegation_level ?? null}
                  onChange={(v) => set("delegation_level", v)}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{delegationHint(form.delegation_level)}</p>
              </Field>
            </>
          )}
          <Field label={`Definition of Done ${dod.length ? `(${dod.filter((i) => i.done).length}/${dod.length})` : ""}`} full>
            <div className="space-y-1.5">
              {dod.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(c) => setDod(dod.map((i) => (i.id === item.id ? { ...i, done: c === true } : i)))}
                  />
                  <Input
                    value={item.text}
                    onChange={(e) => setDod(dod.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)))}
                    className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDod(dod.filter((i) => i.id !== item.id))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar critério…"
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCriterion.trim()) {
                      e.preventDefault();
                      setDod([...dod, newDodItem(newCriterion.trim())]);
                      setNewCriterion("");
                    }
                  }}
                  className="h-8"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!newCriterion.trim()}
                  onClick={() => {
                    setDod([...dod, newDodItem(newCriterion.trim())]);
                    setNewCriterion("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    const existing = new Set(dod.map((i) => i.text.toLowerCase()));
                    const add = suggestDod({
                      impact_type: form.impact_type as string | null,
                      recurrence: form.recurrence as string | null,
                      needs_review: form.needs_review,
                      expected_output: form.expected_output,
                    })
                      .filter((t) => !existing.has(t.toLowerCase()))
                      .map(newDodItem);
                    setDod([...dod, ...add]);
                  }}
                >
                  <Lightbulb className="mr-1 h-3.5 w-3.5" /> Sugerir critérios
                </Button>
                {previousDod && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDod(previousDod)}>
                    Usar DoD da ocorrência anterior
                  </Button>
                )}
              </div>
            </div>
          </Field>
        </Section>

        {form.status === "done" && devVisible && (
          <Section title="Pós-task (obrigatório)">
            <Field label="Houve retrabalho?">
              <ToggleRow
                options={[
                  { value: "yes", label: "Sim" },
                  { value: "no", label: "Não" },
                ]}
                value={form.rework == null ? null : form.rework ? "yes" : "no"}
                onChange={(v) => set("rework", v == null ? null : v === "yes")}
              />
            </Field>
            <Field label="Intervenção do gestor?">
              <ToggleRow
                options={[
                  { value: "yes", label: "Sim" },
                  { value: "no", label: "Não" },
                ]}
                value={form.manager_intervention == null ? null : form.manager_intervention ? "yes" : "no"}
                onChange={(v) => set("manager_intervention", v == null ? null : v === "yes")}
              />
            </Field>
            <Field label="Autonomia percebida" full>
              <ToggleRow
                options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
                value={form.perceived_autonomy ?? null}
                onChange={(v) => set("perceived_autonomy", v)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">1 = precisou de muito apoio · 5 = totalmente autônomo</p>
            </Field>
          </Section>
        )}

        <Section title="Governança">
          <Field label="Precisa de revisão">
            <div className="flex h-9 items-center"><Switch checked={!!form.needs_review} onCheckedChange={(v) => set("needs_review", v)} /></div>
          </Field>
          <Field label="Revisor">
            <Select value={form.reviewer_id ?? ""} onValueChange={(v) => set("reviewer_id", v || null)} disabled={!form.needs_review}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {task && form.needs_review && (
            <div className="col-span-2 flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div>
                <div className="text-sm font-medium">Solicitar revisão</div>
                <div className="text-xs text-muted-foreground">Envia email com link direto para o revisor.</div>
              </div>
              <Button type="button" variant="secondary" disabled={sendReview.isPending || !form.reviewer_id} onClick={() => sendReview.mutate(false)}>
                {sendReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-2">Enviar</span>
              </Button>
            </div>
          )}
        </Section>

        <Section title="Controle">
          <Field label="Bloqueada">
            <div className="flex h-9 items-center"><Switch checked={!!form.is_blocked} onCheckedChange={(v) => set("is_blocked", v)} /></div>
          </Field>
          {form.is_blocked && (
            <Field label="Motivo do bloqueio" full>
              <Textarea rows={2} value={form.blocked_reason ?? ""} onChange={(e) => set("blocked_reason", e.target.value)} />
            </Field>
          )}
        </Section>

        <Section title="Modelo">
          <div className="col-span-2 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-48">
              <Label className="text-xs">Salvar esta tarefa como modelo</Label>
              <Input
                className="mt-1"
                placeholder={form.title || "Nome do modelo"}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" disabled={saveTemplate.isPending} onClick={() => saveTemplate.mutate()}>
              {saveTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar como modelo
            </Button>
          </div>
        </Section>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {task && (
              <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir tarefa?")) del.mutate(); }} disabled={del.isPending}>
                <Trash2 className="mr-1 h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <span className="self-center text-xs text-muted-foreground">Impacto: {fmtUSD(Number(form.estimated_impact_usd ?? 0))}</span>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {task ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}