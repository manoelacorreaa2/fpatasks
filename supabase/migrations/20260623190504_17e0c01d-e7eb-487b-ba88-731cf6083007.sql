
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.task_status AS ENUM ('todo', 'doing', 'done');
CREATE TYPE public.task_urgency AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.impact_type AS ENUM ('revenue', 'cost_reduction', 'margin_pct');
CREATE TYPE public.review_status AS ENUM ('pending', 'requested', 'approved', 'changes_requested');
CREATE TYPE public.snapshot_scope AS ENUM ('team', 'user');

-- UPDATED_AT helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Auto-create profile + member role on signup; promote specific email to admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Default role: member
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Seed admin for Manoela (single admin to bootstrap the team)
  IF NEW.email = 'manoela.correa@worldpackers.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  urgency public.task_urgency NOT NULL DEFAULT 'medium',
  deadline DATE,
  position INTEGER NOT NULL DEFAULT 0,
  -- Estratégico
  impacts_margin BOOLEAN NOT NULL DEFAULT false,
  estimated_hours NUMERIC(10,2),
  expected_output TEXT,
  impact_type public.impact_type,
  estimated_impact_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_impact_usd NUMERIC(14,2),
  confidence INTEGER NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  -- Governança
  needs_review BOOLEAN NOT NULL DEFAULT false,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_status public.review_status NOT NULL DEFAULT 'pending',
  -- Controle
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_auth" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_delete_auth" ON public.tasks FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_deadline ON public.tasks(deadline);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Set completed_at when status moves to done
CREATE OR REPLACE FUNCTION public.tasks_set_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tasks_completed_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_set_completed_at();

-- EMAIL_LOGS
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  sent_to TEXT NOT NULL,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  template TEXT NOT NULL DEFAULT 'review_request',
  status TEXT NOT NULL CHECK (status IN ('sent','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_logs_select_auth" ON public.email_logs FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_email_logs_task ON public.email_logs(task_id, created_at DESC);

-- KPI SNAPSHOTS
CREATE TABLE public.kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  scope public.snapshot_scope NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_tasks INT NOT NULL DEFAULT 0,
  todo_count INT NOT NULL DEFAULT 0,
  doing_count INT NOT NULL DEFAULT 0,
  done_count INT NOT NULL DEFAULT 0,
  overdue_count INT NOT NULL DEFAULT 0,
  margin_impact_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  estimated_impact_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_impact_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  gap_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  accuracy_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, scope, user_id)
);
GRANT SELECT ON public.kpi_snapshots TO authenticated;
GRANT ALL ON public.kpi_snapshots TO service_role;
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_snapshots_select_auth" ON public.kpi_snapshots FOR SELECT TO authenticated USING (true);

-- View: tasks_with_score (RICE adapted)
CREATE OR REPLACE VIEW public.tasks_with_score AS
SELECT
  t.*,
  -- score components
  CASE WHEN t.impacts_margin THEN 2.0 ELSE 1.0 END AS s_reach,
  LEAST(GREATEST(t.estimated_impact_usd / 50000.0, 0.25), 3.0) AS s_impact_norm,
  (t.confidence::numeric / 5.0) AS s_confidence_n,
  GREATEST(COALESCE(t.estimated_hours, 4), 0.5) AS s_effort,
  CASE t.urgency
    WHEN 'low' THEN 1.0
    WHEN 'medium' THEN 1.3
    WHEN 'high' THEN 1.7
    WHEN 'critical' THEN 2.2
  END AS s_urgency_mult,
  CASE
    WHEN t.deadline IS NULL THEN 1.0
    ELSE 1.0 + GREATEST(0, (7 - (t.deadline - CURRENT_DATE))) / 7.0 * 0.5
  END AS s_deadline_mult,
  (
    CASE WHEN t.impacts_margin THEN 2.0 ELSE 1.0 END
    * LEAST(GREATEST(t.estimated_impact_usd / 50000.0, 0.25), 3.0)
    * (t.confidence::numeric / 5.0)
    / GREATEST(COALESCE(t.estimated_hours, 4), 0.5)
    * CASE t.urgency WHEN 'low' THEN 1.0 WHEN 'medium' THEN 1.3 WHEN 'high' THEN 1.7 WHEN 'critical' THEN 2.2 END
    * CASE WHEN t.deadline IS NULL THEN 1.0
           ELSE 1.0 + GREATEST(0, (7 - (t.deadline - CURRENT_DATE))) / 7.0 * 0.5 END
  ) AS score,
  CASE
    WHEN t.deadline IS NOT NULL AND t.deadline < CURRENT_DATE AND t.status <> 'done' THEN true
    ELSE false
  END AS is_overdue
FROM public.tasks t;

GRANT SELECT ON public.tasks_with_score TO authenticated;
GRANT SELECT ON public.tasks_with_score TO service_role;
