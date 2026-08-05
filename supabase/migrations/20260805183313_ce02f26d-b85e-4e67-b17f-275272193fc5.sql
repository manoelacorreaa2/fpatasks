CREATE TYPE public.task_trm AS ENUM ('d1','d2','d3','d4');
CREATE TYPE public.leadership_style AS ENUM ('s1','s2','s3','s4');

ALTER TABLE public.tasks
  ADD COLUMN trm public.task_trm,
  ADD COLUMN leadership_style public.leadership_style,
  ADD COLUMN leadership_style_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN delegation_level integer,
  ADD COLUMN dod jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN rework boolean,
  ADD COLUMN manager_intervention boolean,
  ADD COLUMN perceived_autonomy integer;

CREATE OR REPLACE FUNCTION public.tasks_validate_development()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.delegation_level IS NOT NULL AND (NEW.delegation_level < 1 OR NEW.delegation_level > 7) THEN
    RAISE EXCEPTION 'delegation_level deve estar entre 1 e 7';
  END IF;
  IF NEW.perceived_autonomy IS NOT NULL AND (NEW.perceived_autonomy < 1 OR NEW.perceived_autonomy > 5) THEN
    RAISE EXCEPTION 'perceived_autonomy deve estar entre 1 e 5';
  END IF;
  IF jsonb_typeof(NEW.dod) <> 'array' THEN
    RAISE EXCEPTION 'dod deve ser um array';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_validate_development_trg
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_validate_development();

DROP VIEW public.tasks_with_score;
CREATE VIEW public.tasks_with_score AS
SELECT id,
    assignee_id,
    created_by,
    title,
    description,
    status,
    urgency,
    deadline,
    "position",
    impacts_margin,
    estimated_hours,
    expected_output,
    impact_type,
    estimated_impact_usd,
    actual_impact_usd,
    confidence,
    needs_review,
    reviewer_id,
    review_status,
    is_blocked,
    blocked_reason,
    completed_at,
    created_at,
    updated_at,
    recurrence,
    trm,
    leadership_style,
    leadership_style_manual,
    delegation_level,
    dod,
    rework,
    manager_intervention,
    perceived_autonomy,
    jsonb_array_length(dod) AS dod_total,
    (SELECT count(*) FROM jsonb_array_elements(dod) e WHERE (e->>'done')::boolean IS TRUE) AS dod_done,
        CASE
            WHEN impacts_margin THEN 2.0
            ELSE 1.0
        END AS s_reach,
    LEAST(GREATEST(estimated_impact_usd / 50000.0, 0.25), 3.0) AS s_impact_norm,
    confidence::numeric / 5.0 AS s_confidence_n,
    GREATEST(COALESCE(estimated_hours, 4::numeric), 0.5) AS s_effort,
        CASE urgency
            WHEN 'low'::task_urgency THEN 1.0
            WHEN 'medium'::task_urgency THEN 1.3
            WHEN 'high'::task_urgency THEN 1.7
            WHEN 'critical'::task_urgency THEN 2.2
            ELSE NULL::numeric
        END AS s_urgency_mult,
        CASE
            WHEN deadline IS NULL THEN 1.0
            ELSE 1.0 + GREATEST(0, 7 - (deadline - CURRENT_DATE))::numeric / 7.0 * 0.5
        END AS s_deadline_mult,
        CASE
            WHEN impacts_margin THEN 2.0
            ELSE 1.0
        END * LEAST(GREATEST(estimated_impact_usd / 50000.0, 0.25), 3.0) * (confidence::numeric / 5.0) / GREATEST(COALESCE(estimated_hours, 4::numeric), 0.5) *
        CASE urgency
            WHEN 'low'::task_urgency THEN 1.0
            WHEN 'medium'::task_urgency THEN 1.3
            WHEN 'high'::task_urgency THEN 1.7
            WHEN 'critical'::task_urgency THEN 2.2
            ELSE NULL::numeric
        END *
        CASE
            WHEN deadline IS NULL THEN 1.0
            ELSE 1.0 + GREATEST(0, 7 - (deadline - CURRENT_DATE))::numeric / 7.0 * 0.5
        END AS score,
        CASE
            WHEN deadline IS NOT NULL AND deadline < CURRENT_DATE AND status <> 'done'::task_status THEN true
            ELSE false
        END AS is_overdue
   FROM tasks t;

GRANT SELECT ON public.tasks_with_score TO authenticated;
GRANT ALL ON public.tasks_with_score TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_clone_on_recurrence_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  base_date date;
  next_deadline date;
  fresh_dod jsonb;
BEGIN
  IF NEW.status = 'done'
     AND (OLD.status IS DISTINCT FROM 'done')
     AND NEW.recurrence IS NOT NULL
     AND NEW.recurrence <> 'one_off' THEN

    base_date := COALESCE(NEW.deadline, CURRENT_DATE);
    next_deadline := CASE NEW.recurrence::text
      WHEN 'daily'   THEN base_date + INTERVAL '1 day'
      WHEN 'weekly'  THEN base_date + INTERVAL '7 days'
      WHEN 'monthly' THEN base_date + INTERVAL '1 month'
      ELSE NULL
    END;

    SELECT COALESCE(jsonb_agg(jsonb_set(e, '{done}', 'false'::jsonb)), '[]'::jsonb)
      INTO fresh_dod
      FROM jsonb_array_elements(COALESCE(NEW.dod, '[]'::jsonb)) e;

    INSERT INTO public.tasks (
      assignee_id, created_by, title, description, status, urgency, deadline,
      impacts_margin, estimated_hours, expected_output, impact_type,
      estimated_impact_usd, actual_impact_usd, confidence, needs_review,
      reviewer_id, review_status, is_blocked, blocked_reason, recurrence,
      trm, leadership_style, leadership_style_manual, delegation_level, dod,
      rework, manager_intervention, perceived_autonomy
    ) VALUES (
      NEW.assignee_id, NEW.created_by, NEW.title, NEW.description, 'todo',
      NEW.urgency, next_deadline, NEW.impacts_margin, NEW.estimated_hours,
      NEW.expected_output, NEW.impact_type, NEW.estimated_impact_usd,
      NULL, NEW.confidence, NEW.needs_review, NEW.reviewer_id, 'pending',
      false, NULL, NEW.recurrence,
      NEW.trm, NEW.leadership_style, NEW.leadership_style_manual, NEW.delegation_level, fresh_dod,
      NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;