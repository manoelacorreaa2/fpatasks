-- 1. Competencies
CREATE TABLE public.competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competencies TO authenticated;
GRANT ALL ON public.competencies TO service_role;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY competencies_select_admin ON public.competencies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY competencies_write_admin ON public.competencies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER competencies_updated_at BEFORE UPDATE ON public.competencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Rating scale labels
CREATE TABLE public.rating_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value integer NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rating_scales TO authenticated;
GRANT ALL ON public.rating_scales TO service_role;
ALTER TABLE public.rating_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY rating_scales_select_auth ON public.rating_scales FOR SELECT TO authenticated USING (true);
CREATE POLICY rating_scales_write_admin ON public.rating_scales FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER rating_scales_updated_at BEFORE UPDATE ON public.rating_scales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Job levels
CREATE TABLE public.job_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  level text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_levels TO authenticated;
GRANT ALL ON public.job_levels TO service_role;
ALTER TABLE public.job_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_levels_select_admin ON public.job_levels FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY job_levels_write_admin ON public.job_levels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER job_levels_updated_at BEFORE UPDATE ON public.job_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.job_level_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_level_id uuid NOT NULL REFERENCES public.job_levels(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  expected_score numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_level_id, competency_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_level_expectations TO authenticated;
GRANT ALL ON public.job_level_expectations TO service_role;
ALTER TABLE public.job_level_expectations ENABLE ROW LEVEL SECURITY;
CREATE POLICY jle_select_admin ON public.job_level_expectations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY jle_write_admin ON public.job_level_expectations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER jle_updated_at BEFORE UPDATE ON public.job_level_expectations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Feedbacks
CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  feedback_date date NOT NULL DEFAULT CURRENT_DATE,
  comment text,
  evidence text,
  strengths text,
  development_points text,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedbacks_subject_date_idx ON public.feedbacks (subject_id, feedback_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedbacks_select_admin ON public.feedbacks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY feedbacks_write_admin ON public.feedbacks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER feedbacks_updated_at BEFORE UPDATE ON public.feedbacks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feedback_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES public.competencies(id) ON DELETE RESTRICT,
  score numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, competency_id)
);
CREATE INDEX feedback_scores_feedback_idx ON public.feedback_scores (feedback_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_scores TO authenticated;
GRANT ALL ON public.feedback_scores TO service_role;
ALTER TABLE public.feedback_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_scores_select_admin ON public.feedback_scores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY feedback_scores_write_admin ON public.feedback_scores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_score_range()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.score IS NOT NULL AND (NEW.score < 1 OR NEW.score > 5) THEN
    RAISE EXCEPTION 'nota deve estar entre 1 e 5';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER feedback_scores_validate BEFORE INSERT OR UPDATE ON public.feedback_scores FOR EACH ROW EXECUTE FUNCTION public.validate_score_range();

-- 5. Profiles job level
ALTER TABLE public.profiles ADD COLUMN job_level_id uuid REFERENCES public.job_levels(id) ON DELETE SET NULL;

-- 6. Task delivery rating
ALTER TABLE public.tasks
  ADD COLUMN delivery_rating integer,
  ADD COLUMN delivery_rating_note text,
  ADD COLUMN delivery_rating_competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.tasks_validate_development()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.delegation_level IS NOT NULL AND (NEW.delegation_level < 1 OR NEW.delegation_level > 7) THEN
    RAISE EXCEPTION 'delegation_level deve estar entre 1 e 7';
  END IF;
  IF NEW.perceived_autonomy IS NOT NULL AND (NEW.perceived_autonomy < 1 OR NEW.perceived_autonomy > 5) THEN
    RAISE EXCEPTION 'perceived_autonomy deve estar entre 1 e 5';
  END IF;
  IF NEW.delivery_rating IS NOT NULL AND (NEW.delivery_rating < 1 OR NEW.delivery_rating > 5) THEN
    RAISE EXCEPTION 'delivery_rating deve estar entre 1 e 5';
  END IF;
  IF jsonb_typeof(NEW.dod) <> 'array' THEN
    RAISE EXCEPTION 'dod deve ser um array';
  END IF;
  RETURN NEW;
END;
$$;

-- 7. View exposes new task fields (appended at the end)
CREATE OR REPLACE VIEW public.tasks_with_score AS
SELECT id, assignee_id, created_by, title, description, status, urgency, deadline, "position",
  impacts_margin, estimated_hours, expected_output, impact_type, estimated_impact_usd,
  actual_impact_usd, confidence, needs_review, reviewer_id, review_status, is_blocked,
  blocked_reason, completed_at, created_at, updated_at, recurrence, trm, leadership_style,
  leadership_style_manual, delegation_level, dod, rework, manager_intervention, perceived_autonomy,
  jsonb_array_length(dod) AS dod_total,
  (SELECT count(*) FROM jsonb_array_elements(t.dod) e(value) WHERE ((e.value ->> 'done')::boolean) IS TRUE) AS dod_done,
  CASE WHEN impacts_margin THEN 2.0 ELSE 1.0 END AS s_reach,
  LEAST(GREATEST(estimated_impact_usd / 50000.0, 0.25), 3.0) AS s_impact_norm,
  confidence::numeric / 5.0 AS s_confidence_n,
  GREATEST(COALESCE(estimated_hours, 4::numeric), 0.5) AS s_effort,
  CASE urgency WHEN 'low' THEN 1.0 WHEN 'medium' THEN 1.3 WHEN 'high' THEN 1.7 WHEN 'critical' THEN 2.2 END AS s_urgency_mult,
  CASE WHEN deadline IS NULL THEN 1.0 ELSE 1.0 + GREATEST(0, 7 - (deadline - CURRENT_DATE))::numeric / 7.0 * 0.5 END AS s_deadline_mult,
  CASE WHEN impacts_margin THEN 2.0 ELSE 1.0 END
    * LEAST(GREATEST(estimated_impact_usd / 50000.0, 0.25), 3.0)
    * (confidence::numeric / 5.0)
    / GREATEST(COALESCE(estimated_hours, 4::numeric), 0.5)
    * CASE urgency WHEN 'low' THEN 1.0 WHEN 'medium' THEN 1.3 WHEN 'high' THEN 1.7 WHEN 'critical' THEN 2.2 END
    * CASE WHEN deadline IS NULL THEN 1.0 ELSE 1.0 + GREATEST(0, 7 - (deadline - CURRENT_DATE))::numeric / 7.0 * 0.5 END AS score,
  CASE WHEN deadline IS NOT NULL AND deadline < CURRENT_DATE AND status <> 'done' THEN true ELSE false END AS is_overdue,
  delivery_rating, delivery_rating_note, delivery_rating_competency_id
FROM tasks t;

-- 8. Seeds
INSERT INTO public.rating_scales (value, label) VALUES
  (1, 'Muito abaixo do esperado'),
  (2, 'Abaixo do esperado'),
  (3, 'Dentro do esperado'),
  (4, 'Acima do esperado'),
  (5, 'Destaque');

INSERT INTO public.competencies (name, slug, sort_order) VALUES
  ('Qualidade das entregas', 'qualidade-entregas', 1),
  ('Cumprimento de prazos', 'prazos', 2),
  ('Autonomia', 'autonomia', 3),
  ('Proatividade', 'proatividade', 4),
  ('Comunicação', 'comunicacao', 5),
  ('Trabalho em equipe', 'trabalho-em-equipe', 6),
  ('Resolução de problemas', 'resolucao-de-problemas', 7),
  ('Conhecimento técnico', 'conhecimento-tecnico', 8),
  ('Organização', 'organizacao', 9),
  ('Responsabilidade / Ownership', 'ownership', 10),
  ('Desenvolvimento contínuo', 'desenvolvimento-continuo', 11),
  ('Liderança', 'lideranca', 12);