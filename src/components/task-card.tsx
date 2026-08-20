import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Ban, CheckCircle2, MailCheck, MailWarning } from "lucide-react";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtUSD, daysUntil } from "@/lib/format";
import { DELEGATION_LEVELS } from "@/lib/development";

const URGENCY_STYLE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

const RECURRENCE_LABEL: Record<string, string> = {
  one_off: "esporádica",
  daily: "diária",
  weekly: "semanal",
  monthly: "mensal",
};

export interface TaskCardData {
  id: string;
  title: string;
  urgency: string;
  deadline: string | null;
  estimated_impact_usd: number | string | null;
  impacts_margin: boolean;
  is_blocked: boolean;
  needs_review: boolean;
  review_status: string;
  score: number | string | null;
  is_overdue: boolean;
  recurrence?: string | null;
  trm?: string | null;
  delegation_level?: number | null;
  dod_total?: number | null;
  dod_done?: number | null;
}

interface TaskCardProps {
  task: TaskCardData;
  onClick?: () => void;
  /** Card da coluna Rotina: mostra botão Concluir e ajuste rápido de delegação. */
  routine?: boolean;
  onComplete?: () => void;
  onDelegationChange?: (level: number) => void;
  busy?: boolean;
}

export function TaskCard({ task, onClick, routine, onComplete, onDelegationChange, busy }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const d = daysUntil(task.deadline);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab rounded-lg border bg-card p-3 shadow-sm hover:border-primary/40 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-snug">{task.title}</div>
        <Badge variant="outline" className="tabular-nums text-xs">
          {Number(task.score ?? 0).toFixed(1)}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${URGENCY_STYLE[task.urgency] ?? ""}`}>
          {task.urgency}
        </span>
        {task.impacts_margin && (
          <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">margem</span>
        )}
        {task.recurrence && task.recurrence !== "one_off" && (
          <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
            {RECURRENCE_LABEL[task.recurrence] ?? task.recurrence}
          </span>
        )}
        {task.trm && (
          <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-sky-700 dark:text-sky-300">
            {task.trm}
          </span>
        )}
        {task.delegation_level != null && (
          <span className="rounded border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-300">
            del {task.delegation_level}
          </span>
        )}
        {!!task.dod_total && (
          <span className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <ListChecks className="h-3 w-3" /> {task.dod_done ?? 0}/{task.dod_total}
          </span>
        )}
        {task.is_blocked && (
          <span className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            <Ban className="h-3 w-3" /> bloqueada
          </span>
        )}
        {task.needs_review && (
          <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            {task.review_status === "requested" ? <MailCheck className="h-3 w-3" /> : <MailWarning className="h-3 w-3" />}
            {task.review_status === "requested" ? "rev. enviada" : "precisa rev."}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className={task.is_overdue ? "font-medium text-destructive" : ""}>
          {task.is_overdue && <AlertCircle className="mr-1 inline h-3 w-3" />}
          {fmtDate(task.deadline)}
          {d != null && d >= 0 && d <= 7 && !task.is_overdue && ` (${d}d)`}
        </span>
        <span className="tabular-nums">{fmtUSD(Number(task.estimated_impact_usd ?? 0))}</span>
      </div>
      {routine && (
        <div
          className="mt-3 space-y-2 border-t pt-2"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {onDelegationChange && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Delegação</div>
              <div className="flex gap-1">
                {DELEGATION_LEVELS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onDelegationChange(n)}
                    className={`h-6 flex-1 rounded border text-[10px] font-medium transition-colors ${
                      task.delegation_level === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {onComplete && (
            <Button size="sm" variant="secondary" className="h-7 w-full text-xs" disabled={busy} onClick={onComplete}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Concluir ocorrência
            </Button>
          )}
        </div>
      )}
    </div>
  );
}