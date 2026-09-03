export type Trm = "d1" | "d2" | "d3" | "d4";
export type Style = "s1" | "s2" | "s3" | "s4";

export interface DodItem {
  id: string;
  text: string;
  done: boolean;
}

export const TRM_OPTIONS: { value: Trm; label: string; hint: string }[] = [
  { value: "d1", label: "D1", hint: "iniciante" },
  { value: "d2", label: "D2", hint: "aprendiz" },
  { value: "d3", label: "D3", hint: "capaz" },
  { value: "d4", label: "D4", hint: "autônomo" },
];

export const STYLE_OPTIONS: { value: Style; label: string; hint: string }[] = [
  { value: "s1", label: "S1", hint: "dirigir" },
  { value: "s2", label: "S2", hint: "orientar" },
  { value: "s3", label: "S3", hint: "apoiar" },
  { value: "s4", label: "S4", hint: "delegar" },
];

export const TRM_TO_STYLE: Record<Trm, Style> = { d1: "s1", d2: "s2", d3: "s3", d4: "s4" };

export interface TrmMatrixRow {
  trm: Trm;
  level: string;
  competence: string;
  commitment: string;
  style: Style;
  styleLabel: string;
  action: string;
}

/** Matriz do modelo de liderança situacional usada na aba Metodologia. */
export const TRM_MATRIX: TrmMatrixRow[] = [
  {
    trm: "d1",
    level: "D1 iniciante",
    competence: "baixa",
    commitment: "alto",
    style: "s1",
    styleLabel: "S1 dirigir",
    action: "muita instrução, pouca conversa de motivação",
  },
  {
    trm: "d2",
    level: "D2 aprendiz",
    competence: "alguma",
    commitment: "baixo",
    style: "s2",
    styleLabel: "S2 treinar",
    action: "muita instrução E muito apoio",
  },
  {
    trm: "d3",
    level: "D3 capaz",
    competence: "alta",
    commitment: "variável",
    style: "s3",
    styleLabel: "S3 apoiar",
    action: "pouca instrução, muito apoio",
  },
  {
    trm: "d4",
    level: "D4 autônomo",
    competence: "alta",
    commitment: "alto",
    style: "s4",
    styleLabel: "S4 delegar",
    action: "recebe o resultado",
  },
];

/** Nota fixa: o nível é da combinação pessoa+task, não da pessoa. */
export const LEVEL_IS_PER_TASK_NOTE =
  "O nível é da combinação pessoa+task, não da pessoa. Se eu explico mais para alguém, é porque aquela task é nova para essa pessoa — não é desconfiança nem preferência. Quando o nível sobe, eu explico menos, e isso é o objetivo.";

export const DELEGATION_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;


/** Horas por semana que uma tarefa recorrente consome. */
export function weeklyHours(recurrence: string | null | undefined, hours: number | null | undefined): number {
  const h = Number(hours ?? 0);
  if (!h) return 0;
  switch (recurrence) {
    case "daily":
      return h * 5;
    case "weekly":
      return h;
    case "monthly":
      return h / 4.33;
    default:
      return 0;
  }
}

export const WEEKLY_CAPACITY_HOURS = 40;

export interface RoutineLoad {
  weeklyHours: number;
  capacityPct: number;
  freeHours: number;
}

export function routineLoad(
  tasks: { recurrence?: string | null; estimated_hours?: number | string | null; status?: string | null }[],
  people = 1,
): RoutineLoad {
  const total = tasks
    .filter((t) => t.recurrence && t.recurrence !== "one_off")
    .reduce((s, t) => s + weeklyHours(t.recurrence, t.estimated_hours == null ? null : Number(t.estimated_hours)), 0);
  const capacity = WEEKLY_CAPACITY_HOURS * Math.max(1, people);
  return {
    weeklyHours: total,
    capacityPct: (total / capacity) * 100,
    freeHours: Math.max(0, capacity - total),
  };
}

/** Média mensal do nível de delegação nas tarefas concluídas (ordem crescente de mês). */
export function delegationTrend(
  tasks: { completed_at?: string | null; delegation_level?: number | null; status?: string | null }[],
): { month: string; avg: number; count: number }[] {
  const buckets = new Map<string, number[]>();
  for (const t of tasks) {
    if (t.status !== "done" || t.delegation_level == null || !t.completed_at) continue;
    const d = new Date(t.completed_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t.delegation_level);
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, vals]) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      return { month: label, avg: vals.reduce((s, n) => s + n, 0) / vals.length, count: vals.length };
    });
}

export function delegationHint(level: number | null | undefined): string {
  if (level == null) return "1–2 gestor decide · 3–4 compartilhado · 5–7 liderado decide";
  if (level <= 2) return "Nível " + level + " — gestor decide";
  if (level <= 4) return "Nível " + level + " — decisão compartilhada";
  return "Nível " + level + " — liderado decide";
}

export function nextTrm(trm: Trm | null | undefined): Trm | null {
  const order: Trm[] = ["d1", "d2", "d3", "d4"];
  if (!trm) return null;
  const i = order.indexOf(trm);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function parseDod(raw: unknown): DodItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v, i) => ({
      id: typeof v["id"] === "string" ? (v["id"] as string) : `dod-${i}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(v["text"] ?? ""),
      done: v["done"] === true,
    }))
    .filter((v) => v.text.trim().length > 0);
}

export function newDodItem(text: string): DodItem {
  return { id: `dod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false };
}

/** Critérios sugeridos com base no tipo de impacto / recorrência da tarefa. */
export function suggestDod(input: {
  impact_type?: string | null;
  recurrence?: string | null;
  needs_review?: boolean | null;
  expected_output?: string | null;
}): string[] {
  const out: string[] = [];
  if (input.expected_output?.trim()) out.push(`Entregável pronto: ${input.expected_output.trim()}`);
  else out.push("Entregável final produzido e salvo no local combinado");

  if (input.impact_type === "revenue") {
    out.push("Números de receita conferidos contra a fonte oficial");
    out.push("Premissas documentadas");
  } else if (input.impact_type === "cost_reduction") {
    out.push("Base de custos reconciliada com o razão");
    out.push("Economia estimada explicada por linha");
  } else if (input.impact_type === "margin_pct") {
    out.push("Cálculo de margem validado (receita e custo)");
    out.push("Comparativo com o mês anterior incluído");
  }

  if (input.recurrence && input.recurrence !== "one_off") {
    out.push("Processo/passo a passo atualizado para a próxima ocorrência");
  }
  if (input.needs_review) out.push("Revisão do responsável aprovada");
  out.push("Impacto real preenchido na tarefa");
  return out;
}

export interface DevStats {
  done: number;
  reworkRate: number | null;
  interventionRate: number | null;
  avgDelegation: number | null;
  avgAutonomy: number | null;
  trmDist: Record<Trm, number>;
}

interface DevTaskLike {
  status?: string | null;
  trm?: string | null;
  delegation_level?: number | null;
  rework?: boolean | null;
  manager_intervention?: boolean | null;
  perceived_autonomy?: number | null;
}

export function devStats(tasks: DevTaskLike[]): DevStats {
  const trmDist: Record<Trm, number> = { d1: 0, d2: 0, d3: 0, d4: 0 };
  for (const t of tasks) {
    if (t.trm && t.trm in trmDist) trmDist[t.trm as Trm]++;
  }
  const doneTasks = tasks.filter((t) => t.status === "done");
  const rework = doneTasks.filter((t) => t.rework != null);
  const interv = doneTasks.filter((t) => t.manager_intervention != null);
  const deleg = tasks.map((t) => t.delegation_level).filter((v): v is number => v != null);
  const auton = doneTasks.map((t) => t.perceived_autonomy).filter((v): v is number => v != null);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null);
  return {
    done: doneTasks.length,
    reworkRate: rework.length ? (rework.filter((t) => t.rework).length / rework.length) * 100 : null,
    interventionRate: interv.length ? (interv.filter((t) => t.manager_intervention).length / interv.length) * 100 : null,
    avgDelegation: avg(deleg),
    avgAutonomy: avg(auton),
    trmDist,
  };
}

/** Sugestões — o sistema nunca aplica nada sozinho. */
export function devSuggestions(
  tasks: (DevTaskLike & { completed_at?: string | null })[],
  currentTrm?: Trm | null,
): string[] {
  const out: string[] = [];
  const doneSorted = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime());
  const last10 = doneSorted.slice(0, 10);
  const clean = doneSorted.slice(0, 3);
  if (
    clean.length >= 3 &&
    clean.every((t) => t.rework === false && t.manager_intervention === false)
  ) {
    const up = nextTrm(currentTrm ?? (clean[0].trm as Trm | null));
    out.push(
      up
        ? `3 entregas seguidas sem retrabalho e sem intervenção — considere subir o TRM para ${up.toUpperCase()}.`
        : "3 entregas seguidas sem retrabalho e sem intervenção — maturidade já no topo (D4).",
    );
  }
  const withRework = last10.filter((t) => t.rework != null);
  if (withRework.length >= 3) {
    const rate = withRework.filter((t) => t.rework).length / withRework.length;
    if (rate > 0.3) {
      out.push(
        `Retrabalho em ${Math.round(rate * 100)}% das últimas entregas — considere revisar o Definition of Done ou reduzir o nível de delegação.`,
      );
    }
  }
  return out;
}
