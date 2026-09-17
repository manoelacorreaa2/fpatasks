import type { Competency, DeliveryRating, FeedbackRecord, TaskDevEvent } from "@/lib/feedbacks.functions";

export const SCALE_FALLBACK: { value: number; label: string }[] = [
  { value: 1, label: "Muito abaixo do esperado" },
  { value: 2, label: "Abaixo do esperado" },
  { value: 3, label: "Dentro do esperado" },
  { value: 4, label: "Acima do esperado" },
  { value: 5, label: "Destaque" },
];

export const PERIODS = [
  { key: "90", label: "3 meses", days: 90 },
  { key: "180", label: "6 meses", days: 180 },
  { key: "365", label: "12 meses", days: 365 },
  { key: "all", label: "Todo o histórico", days: null as number | null },
];

export function scaleLabel(scale: { value: number; label: string }[], value: number) {
  const list = scale.length ? scale : SCALE_FALLBACK;
  return list.find((s) => s.value === Math.round(value))?.label ?? String(value);
}

export function cutoff(days: number | null): string | null {
  if (days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export interface ScorePoint {
  date: string;
  competencyId: string;
  score: number;
  source: "feedback" | "delivery";
  label: string;
}

/** Achata feedbacks e notas de entrega numa série única de pontos. */
export function flattenScores(feedbacks: FeedbackRecord[], deliveries: DeliveryRating[]): ScorePoint[] {
  const points: ScorePoint[] = [];
  for (const f of feedbacks) {
    for (const s of f.scores) {
      points.push({
        date: f.feedback_date,
        competencyId: s.competency_id,
        score: s.score,
        source: "feedback",
        label: f.author_name ? `Feedback de ${f.author_name}` : "Feedback",
      });
    }
  }
  for (const d of deliveries) {
    if (!d.date) continue;
    points.push({
      date: d.date,
      competencyId: d.competency_id ?? "",
      score: d.rating,
      source: "delivery",
      label: d.title,
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export function inPeriod<T extends { date: string }>(items: T[], days: number | null): T[] {
  const from = cutoff(days);
  return from ? items.filter((i) => i.date >= from) : items;
}

export function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface CompetencyStat {
  competencyId: string;
  current: number | null;
  currentDate: string | null;
  average: number | null;
  count: number;
  trend: Trend;
}

export type Trend = { kind: "up" | "flat" | "down"; delta: number } | { kind: "insufficient" };

const MIN_PER_SIDE = 2;
const MIN_DELTA = 0.3;

/** Compara o período atual com o período anterior de mesmo tamanho. */
export function trendFor(points: ScorePoint[], days: number | null): Trend {
  const span = days ?? 365;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - span);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - span);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const current = points.filter((p) => p.date >= iso(start));
  const previous = points.filter((p) => p.date >= iso(prevStart) && p.date < iso(start));
  if (current.length < MIN_PER_SIDE || previous.length < MIN_PER_SIDE) return { kind: "insufficient" };
  const a = avg(current.map((p) => p.score))!;
  const b = avg(previous.map((p) => p.score))!;
  const delta = a - b;
  if (Math.abs(delta) < MIN_DELTA) return { kind: "flat", delta };
  return { kind: delta > 0 ? "up" : "down", delta };
}

export function competencyStats(points: ScorePoint[], competencies: Competency[], days: number | null): CompetencyStat[] {
  const scoped = inPeriod(points, days);
  return competencies.map((c) => {
    const mine = scoped.filter((p) => p.competencyId === c.id);
    const last = mine.length ? mine[mine.length - 1] : null;
    return {
      competencyId: c.id,
      current: last ? last.score : null,
      currentDate: last ? last.date : null,
      average: avg(mine.map((p) => p.score)),
      count: mine.length,
      trend: trendFor(
        points.filter((p) => p.competencyId === c.id),
        days,
      ),
    };
  });
}

export interface MonthlyRow {
  month: string;
  feedback: number | null;
  delivery: number | null;
}

/** Média por mês; meses sem registro não geram ponto (não inventamos linha). */
export function monthlySeries(points: ScorePoint[], competencyId: string | "all"): MonthlyRow[] {
  const filtered = competencyId === "all" ? points : points.filter((p) => p.competencyId === competencyId);
  const byMonth = new Map<string, { fb: number[]; dl: number[] }>();
  for (const p of filtered) {
    const m = p.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, { fb: [], dl: [] });
    const bucket = byMonth.get(m)!;
    (p.source === "feedback" ? bucket.fb : bucket.dl).push(p.score);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      feedback: avg(v.fb),
      delivery: avg(v.dl),
    }));
}

export interface RadarRow {
  competency: string;
  atual: number | null;
  anterior: number | null;
  esperado?: number | null;
}

export function radarData(
  points: ScorePoint[],
  competencies: Competency[],
  days: number | null,
  expectations?: { competency_id: string; expected_score: number }[],
): RadarRow[] {
  const span = days ?? 365;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date();
  start.setDate(start.getDate() - span);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - span);

  return competencies
    .filter((c) => c.is_active)
    .map((c) => {
      const mine = points.filter((p) => p.competencyId === c.id);
      const cur = avg(mine.filter((p) => p.date >= iso(start)).map((p) => p.score));
      const prev = avg(mine.filter((p) => p.date >= iso(prevStart) && p.date < iso(start)).map((p) => p.score));
      return {
        competency: c.name,
        atual: cur,
        anterior: prev,
        esperado: expectations?.find((e) => e.competency_id === c.id)?.expected_score ?? null,
      };
    });
}

export interface TimelineItem {
  date: string;
  kind: "feedback" | "delivery" | "task";
  text: string;
  detail?: string | null;
}

export function buildTimeline(
  feedbacks: FeedbackRecord[],
  deliveries: DeliveryRating[],
  tasks: TaskDevEvent[],
  competencies: Competency[],
  scale: { value: number; label: string }[],
  days: number | null,
): TimelineItem[] {
  const nameOf = (id: string | null) => competencies.find((c) => c.id === id)?.name ?? "Geral";
  const items: TimelineItem[] = [];

  for (const f of feedbacks) {
    const scores = f.scores.map((s) => `${nameOf(s.competency_id)}: ${s.score}`).join(" · ");
    items.push({
      date: f.feedback_date,
      kind: "feedback",
      text: scores || "Feedback registrado",
      detail: f.comment ?? f.strengths ?? null,
    });
  }
  for (const d of deliveries) {
    if (!d.date) continue;
    items.push({
      date: d.date,
      kind: "delivery",
      text: `${d.title}: ${scaleLabel(scale, d.rating).toLowerCase()}`,
      detail: d.note ?? null,
    });
  }
  for (const t of tasks) {
    if (!t.completed_at) continue;
    const impact = t.actual_impact_usd ?? t.estimated_impact_usd ?? 0;
    if (!t.trm && !impact) continue;
    items.push({
      date: t.completed_at.slice(0, 10),
      kind: "task",
      text: `Entrega concluída: ${t.title}`,
      detail: [t.trm ? `TRM ${t.trm.toUpperCase()}` : null, t.delegation_level ? `Delegação ${t.delegation_level}` : null]
        .filter(Boolean)
        .join(" · "),
    });
  }

  const from = cutoff(days);
  return items
    .filter((i) => (from ? i.date >= from : true))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Frases repetidas nos campos de pontos fortes / desenvolvimento — sem inventar nada. */
export function recurringPoints(feedbacks: FeedbackRecord[], field: "strengths" | "development_points"): string[] {
  const counts = new Map<string, number>();
  for (const f of feedbacks) {
    const raw = f[field];
    if (!raw) continue;
    for (const piece of raw.split(/[\n;·]|(?:, )/)) {
      const t = piece.trim();
      if (t.length < 4) continue;
      const key = t.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([text, n]) => (n > 1 ? `${text} (${n}x)` : text));
}

export function trmDistribution(tasks: TaskDevEvent[], days: number | null) {
  const from = cutoff(days);
  const scoped = tasks.filter((t) => t.completed_at && (from ? t.completed_at.slice(0, 10) >= from : true));
  const counts = new Map<string, number>();
  for (const t of scoped) {
    if (!t.trm) continue;
    counts.set(t.trm, (counts.get(t.trm) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const predominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  return { counts, total, predominant: predominant ? { trm: predominant[0], count: predominant[1] } : null };
}
