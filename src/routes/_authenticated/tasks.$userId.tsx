import { createFileRoute, useParams } from "@tanstack/react-router";
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
import { TaskCard, type TaskCardData } from "@/components/task-card";
import { TaskModal } from "@/components/task-modal";
import { useAuth } from "@/hooks/use-auth";
import { fmtUSD, initials } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/tasks/$userId")({
  component: TasksPage,
});

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type ScoredTask = Database["public"]["Views"]["tasks_with_score"]["Row"];

const COLUMNS: { id: "todo" | "doing" | "done"; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "Fazendo" },
  { id: "done", label: "Feito" },
];

function TasksPage() {
  const { userId } = useParams({ from: "/_authenticated/tasks/$userId" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  const byCol = useMemo(() => {
    const cols: Record<string, ScoredTask[]> = { todo: [], doing: [], done: [] };
    for (const t of filtered) {
      if (t.status && cols[t.status]) cols[t.status].push(t);
    }
    return cols;
  }, [filtered]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    const targetStatus = (COLUMNS.find((c) => c.id === overId)?.id ??
      tasks.find((t) => t.id === overId)?.status) as "todo" | "doing" | "done" | undefined;
    if (!targetStatus) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Optimistic
    qc.setQueryData<ScoredTask[]>(["tasks_by_assignee", userId], (prev) =>
      (prev ?? []).map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)),
    );

    const patch: Partial<Task> = { status: targetStatus };
    if (targetStatus === "done" && (task.actual_impact_usd == null || Number(task.actual_impact_usd) === 0)) {
      const v = window.prompt(`Tarefa concluída! Qual o impacto REAL em USD? (estimado: ${fmtUSD(Number(task.estimated_impact_usd))})`,
        String(Number(task.estimated_impact_usd ?? 0)));
      if (v != null) patch.actual_impact_usd = Number(v);
    }
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) {
      toast.error("Falha ao mover: " + error.message);
    } else {
      qc.invalidateQueries({ queryKey: ["tasks_with_score"] });
    }
    qc.invalidateQueries({ queryKey: ["tasks_by_assignee", userId] });
  };

  const profile = profileQ.data;

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
        <div className="flex gap-2">
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> Nova tarefa</Button>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = byCol[col.id] ?? [];
            const sum = items.reduce((s, t) => s + Number(t.estimated_impact_usd ?? 0), 0);
            return (
              <Column key={col.id} id={col.id} label={col.label} count={items.length} sum={sum}>
                <SortableContext items={items.map((t) => t.id!)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={toCard(t)}
                        onClick={() => setEditing(t as Task)}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                        Solte tarefas aqui
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
          onClose={() => { setEditing(null); setCreating(false); }}
          task={editing}
          assigneeId={userId}
          currentUserId={user.id}
          profiles={profilesQ.data ?? []}
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
  };
}

function Column({ id, label, count, sum, children }: { id: string; label: string; count: number; sum: number; children: React.ReactNode }) {
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
      {children}
    </div>
  );
}