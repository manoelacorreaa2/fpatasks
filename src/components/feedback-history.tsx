import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteFeedback, type Competency, type FeedbackRecord } from "@/lib/feedbacks.functions";

interface Props {
  feedbacks: FeedbackRecord[];
  competencies: Competency[];
  onEdit: (f: FeedbackRecord) => void;
}

const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");

export function FeedbackHistory({ feedbacks, competencies, onEdit }: Props) {
  const qc = useQueryClient();
  const remove = useServerFn(deleteFeedback);
  const [openId, setOpenId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      await remove({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Feedback excluído");
      qc.invalidateQueries({ queryKey: ["dossier"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string) => competencies.find((c) => c.id === id);

  if (!feedbacks.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum feedback registrado ainda.</p>;
  }

  return (
    <div className="divide-y rounded-lg border">
      {feedbacks.map((f) => {
        const expanded = openId === f.id;
        return (
          <div key={f.id} className="p-3">
            <div className="flex items-start gap-2">
              <button className="mt-0.5 text-muted-foreground" onClick={() => setOpenId(expanded ? null : f.id)}>
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{fmtDate(f.feedback_date)}</span>
                  <span className="text-xs text-muted-foreground">{f.author_name ?? "Avaliador"}</span>
                  {f.updated_at && f.created_at && f.updated_at.slice(0, 16) !== f.created_at.slice(0, 16) && (
                    <span className="text-[10px] text-muted-foreground">(editado)</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {f.scores.map((s) => {
                    const c = nameOf(s.competency_id);
                    return (
                      <Badge key={s.competency_id} variant="secondary" className="text-[10px]">
                        {c?.name ?? "Competência"}{c && !c.is_active ? " (inativa)" : ""}: {s.score}
                      </Badge>
                    );
                  })}
                </div>
                {expanded && (
                  <div className="mt-3 space-y-2 text-sm">
                    {[
                      ["Comentário", f.comment],
                      ["Evidências", f.evidence],
                      ["Pontos positivos", f.strengths],
                      ["Pontos de desenvolvimento", f.development_points],
                      ["Próxima ação", f.next_action],
                    ]
                      .filter(([, v]) => !!v)
                      .map(([label, v]) => (
                        <div key={label as string}>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                          <div className="whitespace-pre-wrap">{v}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(f)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => del.mutate(f.id)}
                  disabled={del.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
