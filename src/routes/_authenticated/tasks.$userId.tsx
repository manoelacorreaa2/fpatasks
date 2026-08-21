import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskCard, type TaskCardData } from "@/components/task-card";
import { TaskModal } from "@/components/task-modal";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { fmtUSD, initials } from "@/lib/format";
import { routineLoad } from "@/lib/development";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/tasks/$userId")({
  component: TasksPage,
});

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type ScoredTask = Database["public"]["Views"]["tasks_with_score"]["Row"];
type Template = Database["public"]["Tables"]["task_templates"]["Row"];

type ColId = "routine" | "todo" | "doing" | "done";

const COLUMNS: { id: ColId; label: string }[] = [
  { id: "routine", label: "Rotina" },
  { id: "todo", label: "To Do" },
  { id: "doing", label: "Fazendo" },
  { id: "done", label: "Feito" },
];

const monthKey = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : "");
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const currentMonth = () => new Date().toISOString().slice(0, 7);

const isRoutine = (t: ScoredTask) => !!t.recurrence && t.recurrence !== "one_off";

function TasksPage() {
  const { userId } = useParams({ from: "/_authenticated/tasks/$userId" });
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [initial, setInitial] = useState<Partial<TaskInsert> | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [doneMonth, setDoneMonth] = useState<string>(currentMonth());
  const [busyId, setBusyId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const canEdit = isAdmin || userId === user?.id;

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const profilesQ = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const templatesQ = useQuery({
    queryKey: ["task_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_templates").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks_by_assignee", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks_with_score")
        .select("*")
        .eq("assignee_id", userId)
        .order("score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScoredTask[];
    },
  });

  const tasks = tasksQ.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t) => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [tasks, search]);

  const doneMonths = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) if (t.status === "done") set.add(monthKey(t.completed_at ?? t.updated_at));
    set.add(currentMonth());
    return [...set].filter(Boolean).sort().reverse();
  }, [tasks]);

  const byCol = useMemo(() => {
    const cols: Record<ColId, ScoredTask[]> = { routine: [], todo: [], doing: [], done: [] };
    for (const t of filtered) {
      if (t.status === "done") {
        const key = monthKey(t.completed_at ?? t.updated_at);
        if (doneMonth === "all" || key === doneMonth) cols.done.push(t);
      } else if (isRoutine(t)) {
        cols.routine.push(t);
      } else if (t.status === "todo" || t.status === "doing") {
        cols[t.status].push(t);
      }
    }
    return cols;
  }, [filtered, doneMonth]);

  const load = useMemo(
    () => routineLoad(tasks.filter((t) => t.status !== "done") as never[], 1),
    [tasks],
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const patchTask = async (taskId: string, patch: Partial<Task>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) toast.error("Falha ao salvar: " + error.message);
    qc.invalidateQueries({ queryKey: ["tasks_with_score"] });
    qc.invalidateQueries({ queryKey: ["tasks_by_assignee", userId] });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    const overCol = COLUMNS.find((c) => c.id === overId)?.id;
    const targetStatus = (
      overCol === "routine" ? "todo" : (overCol ?? tasks.find((t) => t.id === overId)?.status)
    ) as "todo" | "doing" | "done" | undefined;
    if (!targetStatus) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    qc.setQueryData<ScoredTask[]>(["tasks_by_assignee", userId], (prev) =>
      (prev ?? []).map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)),
    );

    const patch: Partial<Task> = { status: targetStatus };
    if (targetStatus === "done" && (task.actual_impact_usd == null || Number(task.actual_impact_usd) === 0)) {
      const v = window.prompt(
        `Tarefa concluída! Qual o impacto REAL em USD? (estimado: ${fmtUSD(Number(task.estimated_impact_usd))})`,
        String(Number(task.estimated_impact_usd ?? 0)),
      );
      if (v != null) patch.actual_impact_usd = Number(v);
    }
    await patchTask(taskId, patch);
  };

  const completeRoutine = async (t: ScoredTask) => {
    if (!t.id) return;
    setBusyId(t.id);
    await patchTask(t.id, {
      status: "done",
      actual_impact_usd:
        t.actual_impact_usd == null || Number(t.actual_impact_usd) === 0
          ? Number(t.estimated_impact_usd ?? 0)
          : Number(t.actual_impact_usd),
    });
    setBusyId(null);
    toast.success("Ocorrência concluída — a próxima já foi criada");
  };

  const profile = profileQ.data;
  const templates = templatesQ.data ?? [];

  const createFromTemplate = (tpl: Template) => {
    setInitial({
      title: tpl.title || tpl.name,
      description: tpl.description,
      urgency: tpl.urgency,
      recurrence: tpl.recurrence,
      impacts_margin: tpl.impacts_margin,
      impact_type: tpl.impact_type,
      estimated_impact_usd: tpl.estimated_impact_usd,
      estimated_hours: tpl.estimated_hours,
      confidence: tpl.confidence,
      expected_output: tpl.expected_output,
      needs_review: tpl.needs_review,
      trm: tpl.trm,
      delegation_level: tpl.delegation_level,
      dod: tpl.dod,
    });
    setCreating(true);
  };

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials(profile?.full_name || profile?.email || "??")}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{profile?.full_name || profile?.email || "—"}</h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} tarefas • {fmtUSD(tasks.reduce((s, t) => s + Number(t.estimated_impact_usd ?? 0), 0))} estimado
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          {canEdit && templates.length > 0 && (
            <Select
              value=""
              onValueChange={(v) => {
                const tpl = templates.find((t) => t.id === v);
                if (tpl) createFromTemplate(tpl);
              }}
            >
              <SelectTrigger className="w-48"><SelectValue placeholder="Criar de um modelo" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {canEdit && (
            <Button onClick={() => { setInitial(null); setCreating(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Nova tarefa
            </Button>
          )}
        </div>
      </header>

      <div className="rounded-lg border bg-card/30 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium">Rotina ocupa {load.weeklyHours.toFixed(1)}h/semana</span>
          <span className="text-muted-foreground tabular-nums">
            {load.capacityPct.toFixed(0)}% da capacidade • {load.freeHours.toFixed(1)}h livres p/ projetos
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${load.capacityPct > 70 ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.min(100, load.capacityPct)}%` }}
          />
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = byCol[col.id] ?? [];
            const sum = items.reduce(
              (s, t) => s + Number((col.id === "done" ? t.actual_impact_usd ?? t.estimated_impact_usd : t.estimated_impact_usd) ?? 0),
              0,
            );
            return (
              <Column
                key={col.id}
                id={col.id}
                label={col.label}
                count={items.length}
                sum={sum}
                header={
                  col.id === "done" ? (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Select value={doneMonth} onValueChange={setDoneMonth}>
                        <SelectTrigger className="h-7 w-full text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {doneMonths.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
                          <SelectItem value="all">Todos</SelectItem>
                        </SelectContent>
                      </Select>
                      <Link to="/historico" className="whitespace-nowrap text-[10px] text-primary underline">
                        histórico
                      </Link>
                    </div>
                  ) : null
                }
              >
                <SortableContext items={items.map((t) => t.id!)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={toCard(t)}
                        routine={col.id === "routine"}
                        busy={busyId === t.id}
                        onComplete={col.id === "routine" && canEdit ? () => completeRoutine(t) : undefined}
                        onDelegationChange={
                          col.id === "routine" && canEdit ? (level) => patchTask(t.id!, { delegation_level: level }) : undefined
                        }
                        onClick={() => setEditing(t as unknown as Task)}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                        {col.id === "routine" ? "Tarefas recorrentes aparecem aqui" : "Solte tarefas aqui"}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={toCard(activeTask)} /> : null}</DragOverlay>
      </DndContext>

      {(editing || creating) && user && (
        <TaskModal
          open
          onClose={() => { setEditing(null); setCreating(false); setInitial(null); }}
          task={editing}
          assigneeId={userId}
          currentUserId={user.id}
          profiles={profilesQ.data ?? []}
          isAdmin={isAdmin}
          initial={initial}
        />
      )}
    </div>
  );
}

function toCard(t: ScoredTask): TaskCardData {
  return {
    id: t.id!,
    title: t.title!,
    urgency: t.urgency!,
    deadline: t.deadline,
    estimated_impact_usd: t.estimated_impact_usd,
    impacts_margin: !!t.impacts_margin,
    is_blocked: !!t.is_blocked,
    needs_review: !!t.needs_review,
    review_status: t.review_status ?? "pending",
    score: t.score,
    is_overdue: !!t.is_overdue,
    recurrence: t.recurrence ?? "one_off",
    trm: t.trm ?? null,
    delegation_level: t.delegation_level ?? null,
    dod_total: t.dod_total ?? null,
    dod_done: t.dod_done == null ? null : Number(t.dod_done),
  };
}

function Column({
  id,
  label,
  count,
  sum,
  header,
  children,
}: {
  id: string;
  label: string;
  count: number;
  sum: number;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`rounded-lg border bg-card/30 p-3 ${isOver ? "ring-2 ring-primary/30" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{count}</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{fmtUSD(sum)}</span>
      </div>
      {header}
      {children}
    </div>
  );
}
