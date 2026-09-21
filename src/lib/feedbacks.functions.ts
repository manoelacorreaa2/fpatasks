import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tudo aqui é restrito a admins: checamos o papel antes de qualquer retorno. */
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a gestores");
}

export interface Competency {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export interface FeedbackScore {
  competency_id: string;
  score: number;
}

export interface FeedbackRecord {
  id: string;
  subject_id: string;
  author_id: string;
  author_name?: string | null;
  feedback_date: string;
  comment: string | null;
  evidence: string | null;
  strengths: string | null;
  development_points: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  scores: FeedbackScore[];
}

export interface DeliveryRating {
  task_id: string;
  title: string;
  date: string;
  rating: number;
  note: string | null;
  competency_id: string | null;
}

export interface TaskDevEvent {
  id: string;
  title: string;
  completed_at: string | null;
  trm: string | null;
  delegation_level: number | null;
  actual_impact_usd: number | null;
  estimated_impact_usd: number | null;
}

export interface JobLevel {
  id: string;
  title: string;
  level: string | null;
  is_active: boolean;
  expectations: { competency_id: string; expected_score: number }[];
}

export interface PersonDossier {
  competencies: Competency[];
  scaleLabels: { value: number; label: string }[];
  feedbacks: FeedbackRecord[];
  deliveryRatings: DeliveryRating[];
  tasks: TaskDevEvent[];
  jobLevel: JobLevel | null;
}

export const listCompetencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Competency[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("competencies")
      .select("id, name, slug, sort_order, is_active")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as Competency[];
  });

const competencySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const saveCompetency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => competencySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { error } = await supabase
        .from("competencies")
        .update({
          name: data.name,
          ...(data.sort_order == null ? {} : { sort_order: data.sort_order }),
          ...(data.is_active == null ? {} : { is_active: data.is_active }),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase.from("competencies").insert({
      name: data.name,
      slug: `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`,
      sort_order: data.sort_order ?? 99,
      is_active: data.is_active ?? true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const feedbackSchema = z.object({
  id: z.string().uuid().optional(),
  subject_id: z.string().uuid(),
  feedback_date: z.string(),
  comment: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  strengths: z.string().nullable().optional(),
  development_points: z.string().nullable().optional(),
  next_action: z.string().nullable().optional(),
  scores: z.array(z.object({ competency_id: z.string().uuid(), score: z.number().min(1).max(5) })),
});

export const saveFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => feedbackSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const payload = {
      subject_id: data.subject_id,
      author_id: userId,
      feedback_date: data.feedback_date,
      comment: data.comment ?? null,
      evidence: data.evidence ?? null,
      strengths: data.strengths ?? null,
      development_points: data.development_points ?? null,
      next_action: data.next_action ?? null,
    };

    let feedbackId = data.id;
    if (feedbackId) {
      const { error } = await supabase.from("feedbacks").update(payload).eq("id", feedbackId);
      if (error) throw new Error(error.message);
      await supabase.from("feedback_scores").delete().eq("feedback_id", feedbackId);
    } else {
      const { data: inserted, error } = await supabase.from("feedbacks").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      feedbackId = inserted.id as string;
    }

    if (data.scores.length > 0) {
      const { error } = await supabase
        .from("feedback_scores")
        .insert(data.scores.map((s) => ({ feedback_id: feedbackId, competency_id: s.competency_id, score: s.score })));
      if (error) throw new Error(error.message);
    }
    return { ok: true, id: feedbackId };
  });

export const deleteFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("feedbacks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPersonDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PersonDossier> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [comps, scale, fbs, tasksRes, profileRes] = await Promise.all([
      supabase.from("competencies").select("id, name, slug, sort_order, is_active").order("sort_order"),
      supabase.from("rating_scales").select("value, label").order("value"),
      supabase
        .from("feedbacks")
        .select(
          "id, subject_id, author_id, feedback_date, comment, evidence, strengths, development_points, next_action, created_at, updated_at, feedback_scores(competency_id, score), author:profiles!feedbacks_author_id_fkey(full_name)",
        )
        .eq("subject_id", data.subjectId)
        .order("feedback_date", { ascending: false }),
      supabase
        .from("tasks")
        .select(
          "id, title, completed_at, created_at, trm, delegation_level, actual_impact_usd, estimated_impact_usd, delivery_rating, delivery_rating_note, delivery_rating_competency_id, status",
        )
        .eq("assignee_id", data.subjectId)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(400),
      supabase.from("profiles").select("job_level_id").eq("id", data.subjectId).maybeSingle(),
    ]);

    if (comps.error) throw new Error(comps.error.message);
    if (fbs.error) throw new Error(fbs.error.message);
    if (tasksRes.error) throw new Error(tasksRes.error.message);

    const feedbacks: FeedbackRecord[] = (fbs.data ?? []).map((f: any) => ({
      id: f.id,
      subject_id: f.subject_id,
      author_id: f.author_id,
      author_name: f.author?.full_name ?? null,
      feedback_date: f.feedback_date,
      comment: f.comment,
      evidence: f.evidence,
      strengths: f.strengths,
      development_points: f.development_points,
      next_action: f.next_action,
      created_at: f.created_at,
      updated_at: f.updated_at,
      scores: (f.feedback_scores ?? []).map((s: any) => ({ competency_id: s.competency_id, score: Number(s.score) })),
    }));

    const allTasks = (tasksRes.data ?? []) as any[];

    const deliveryRatings: DeliveryRating[] = allTasks
      .filter((t) => t.delivery_rating != null)
      .map((t) => ({
        task_id: t.id,
        title: t.title,
        date: (t.completed_at ?? t.created_at)?.slice(0, 10),
        rating: Number(t.delivery_rating),
        note: t.delivery_rating_note ?? null,
        competency_id: t.delivery_rating_competency_id ?? null,
      }));

    const tasks: TaskDevEvent[] = allTasks
      .filter((t) => t.status === "done")
      .map((t) => ({
        id: t.id,
        title: t.title,
        completed_at: t.completed_at,
        trm: t.trm,
        delegation_level: t.delegation_level,
        actual_impact_usd: t.actual_impact_usd == null ? null : Number(t.actual_impact_usd),
        estimated_impact_usd: Number(t.estimated_impact_usd ?? 0),
      }));

    let jobLevel: JobLevel | null = null;
    const jobLevelId = (profileRes.data as any)?.job_level_id ?? null;
    if (jobLevelId) {
      const { data: jl } = await supabase
        .from("job_levels")
        .select("id, title, level, is_active, job_level_expectations(competency_id, expected_score)")
        .eq("id", jobLevelId)
        .maybeSingle();
      if (jl) {
        jobLevel = {
          id: (jl as any).id,
          title: (jl as any).title,
          level: (jl as any).level,
          is_active: (jl as any).is_active,
          expectations: ((jl as any).job_level_expectations ?? []).map((e: any) => ({
            competency_id: e.competency_id,
            expected_score: Number(e.expected_score),
          })),
        };
      }
    }

    return {
      competencies: (comps.data ?? []) as Competency[],
      scaleLabels: (scale.data ?? []) as { value: number; label: string }[],
      feedbacks,
      deliveryRatings,
      tasks,
      jobLevel,
    };
  });

export const listJobLevels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JobLevel[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("job_levels")
      .select("id, title, level, is_active, job_level_expectations(competency_id, expected_score)")
      .order("title");
    if (error) throw new Error(error.message);
    return (data ?? []).map((j: any) => ({
      id: j.id,
      title: j.title,
      level: j.level,
      is_active: j.is_active,
      expectations: (j.job_level_expectations ?? []).map((e: any) => ({
        competency_id: e.competency_id,
        expected_score: Number(e.expected_score),
      })),
    }));
  });

const jobLevelSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  level: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  expectations: z.array(z.object({ competency_id: z.string().uuid(), expected_score: z.number().min(1).max(5) })).optional(),
});

export const saveJobLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobLevelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let id = data.id;
    const payload = { title: data.title, level: data.level ?? null, is_active: data.is_active ?? true };
    if (id) {
      const { error } = await supabase.from("job_levels").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await supabase.from("job_levels").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      id = ins.id as string;
    }
    if (data.expectations) {
      await supabase.from("job_level_expectations").delete().eq("job_level_id", id);
      if (data.expectations.length) {
        const { error } = await supabase
          .from("job_level_expectations")
          .insert(data.expectations.map((e) => ({ job_level_id: id, competency_id: e.competency_id, expected_score: e.expected_score })));
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true, id };
  });

export const setProfileJobLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ profileId: z.string().uuid(), jobLevelId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    // RLS on profiles only allows self-updates, so admins assign job levels through the admin client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({ job_level_id: data.jobLevelId })
      .eq("id", data.profileId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Pessoa não encontrada");
    return { ok: true };
  });
