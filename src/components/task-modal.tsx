import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { computeScore, type Urgency } from "@/lib/scoring";
import { fmtUSD } from "@/lib/format";
import { requestReview } from "@/lib/tasks.functions";
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
});

export function TaskModal({ open, onClose, task, assigneeId, currentUserId, profiles }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TaskInsert>(() => empty(assigneeId, currentUserId));
  const requestReviewFn = useServerFn(requestReview);

  useEffect(() => {
    if (task) {
      setForm({ ...task });
    } else {
      setForm(empty(assigneeId, currentUserId));
    }
  }, [task, assigneeId, currentUserId, open]);

  const set = <K extends keyof TaskInsert>(k: K, v: TaskInsert[K]) => setForm((f) => ({ ...f, [k]: v }));

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
      if (task) {
        const { error } = await supabase.from("tasks").update(form).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      qc.invalidateQueries({ queryKey: ["tasks_with_score"] });
      qc.invalidateQueries({ queryKey: ["tasks_by_assignee"] });
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
          <Field label="Responsável">
            <Select value={form.assignee_id} onValueChange={(v) => set("assignee_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
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