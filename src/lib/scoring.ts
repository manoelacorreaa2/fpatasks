import type { Database } from "@/integrations/supabase/types";

export type Urgency = "low" | "medium" | "high" | "critical";

const URGENCY_MULT: Record<Urgency, number> = {
  low: 1.0,
  medium: 1.3,
  high: 1.7,
  critical: 2.2,
};

export interface ScoreInput {
  impacts_margin: boolean;
  estimated_impact_usd: number;
  confidence: number; // 1-5
  estimated_hours: number | null;
  urgency: Urgency;
  deadline: string | null; // ISO date
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function computeScore(t: ScoreInput): number {
  const reach = t.impacts_margin ? 2 : 1;
  const impactNorm = clamp((t.estimated_impact_usd || 0) / 50000, 0.25, 3);
  const confidenceN = (t.confidence || 3) / 5;
  const effort = Math.max(t.estimated_hours ?? 4, 0.5);
  const urgencyMult = URGENCY_MULT[t.urgency];
  let deadlineMult = 1;
  if (t.deadline) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(t.deadline);
    const days = Math.floor((d.getTime() - now.getTime()) / 86400000);
    deadlineMult = 1 + Math.max(0, 7 - days) / 7 * 0.5;
  }
  return (reach * impactNorm * confidenceN) / effort * urgencyMult * deadlineMult;
}

export function accuracyPct(estimated: number, actual: number | null | undefined): number | null {
  if (actual == null || !estimated || estimated <= 0) return null;
  const acc = 1 - Math.abs(actual - estimated) / Math.max(estimated, 1);
  return clamp(acc, 0, 1) * 100;
}

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];