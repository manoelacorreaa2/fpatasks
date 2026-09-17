import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleRow } from "@/components/toggle-row";
import { saveFeedback, type Competency, type FeedbackRecord } from "@/lib/feedbacks.functions";
import { SCALE_FALLBACK } from "@/lib/feedbacks";

interface Props {
  open: boolean;
  onClose: () => void;
  subjectId: string;
  subjectName: string;
  competencies: Competency[];
  scale: { value: number; label: string }[];
  editing?: FeedbackRecord | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function FeedbackForm({ open, onClose, subjectId, subjectName, competencies, scale, editing = null }: Props) {
  const qc = useQueryClient();
  const save = useServerFn(saveFeedback);
  const [date, setDate] = useState(today());
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [evidence, setEvidence] = useState("");
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");
  const [nextAction, setNextAction] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.feedback_date.slice(0, 10));
      setScores(Object.fromEntries(editing.scores.map((s) => [s.competency_id, s.score])));
      setComment(editing.comment ?? "");
      setEvidence(editing.evidence ?? "");
      setStrengths(editing.strengths ?? "");
      setDevelopment(editing.development_points ?? "");
      setNextAction(editing.next_action ?? "");
    } else {
      setDate(today());
      setScores({});
      setComment("");
      setEvidence("");
      setStrengths("");
      setDevelopment("");
      setNextAction("");
    }
  }, [open, editing]);

  const labels = scale.length ? scale : SCALE_FALLBACK;

  const mutation = useMutation({
    mutationFn: async () => {
      const list = Object.entries(scores).map(([competency_id, score]) => ({ competency_id, score }));
      if (!list.length) throw new Error("Dê nota em pelo menos uma competência");
      await save({
        data: {
          ...(editing ? { id: editing.id } : {}),
          subject_id: subjectId,
          feedback_date: date,
          comment: comment || null,
          evidence: evidence || null,
          strengths: strengths || null,
          development_points: development || null,
          next_action: nextAction || null,
          scores: list,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Feedback atualizado" : "Feedback registrado");
      qc.invalidateQueries({ queryKey: ["dossier"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar feedback" : "Novo feedback"} — {subjectName}</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" className="mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Liderado</Label>
              <Input className="mt-1" value={subjectName} readOnly disabled />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs">Notas por competência</Label>
            <p className="text-[11px] text-muted-foreground">
              {labels.map((l) => `${l.value} ${l.label.toLowerCase()}`).join(" · ")}
            </p>
            <div className="space-y-2">
              {competencies
                .filter((c) => c.is_active)
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <span className="text-sm">{c.name}</span>
                    <ToggleRow
                      options={labels.map((l) => ({ value: l.value, label: String(l.value) }))}
                      value={scores[c.id] ?? null}
                      onChange={(v) =>
                        setScores((s) => {
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
          </div>

          {[
            { label: "Comentário geral", value: comment, set: setComment },
            { label: "Evidências / exemplos", value: evidence, set: setEvidence },
            { label: "Pontos positivos", value: strengths, set: setStrengths },
            { label: "Pontos de desenvolvimento", value: development, set: setDevelopment },
            { label: "Próxima ação recomendada", value: nextAction, set: setNextAction },
          ].map((f) => (
            <div key={f.label}>
              <Label className="text-xs">{f.label}</Label>
              <Textarea rows={2} className="mt-1" value={f.value} onChange={(e) => f.set(e.target.value)} />
            </div>
          ))}

          <div className="flex justify-end gap-2 pb-6">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
