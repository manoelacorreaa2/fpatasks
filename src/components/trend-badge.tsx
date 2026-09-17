import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import type { Trend } from "@/lib/feedbacks";
import { cn } from "@/lib/utils";

export function TrendBadge({ trend, className }: { trend: Trend; className?: string }) {
  if (trend.kind === "insufficient") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", className)} title="Dados insuficientes para calcular tendência.">
        <Minus className="h-3 w-3" /> sem base
      </span>
    );
  }
  const map = {
    up: { Icon: ArrowUpRight, label: "Evoluindo", cls: "text-emerald-600 dark:text-emerald-400" },
    flat: { Icon: ArrowRight, label: "Estável", cls: "text-muted-foreground" },
    down: { Icon: ArrowDownRight, label: "Atenção", cls: "text-amber-600 dark:text-amber-400" },
  }[trend.kind];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", map.cls, className)}>
      <map.Icon className="h-3 w-3" />
      {map.label} ({trend.delta > 0 ? "+" : ""}
      {trend.delta.toFixed(1)})
    </span>
  );
}
