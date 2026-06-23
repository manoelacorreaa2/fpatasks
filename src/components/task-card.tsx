import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Ban, MailCheck, MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtUSD, daysUntil } from "@/lib/format";

const URGENCY_STYLE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
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
}

export function TaskCard({ task, onClick }: { task: TaskCardData; onClick?: () => void }) {
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
    </div>
  );
}