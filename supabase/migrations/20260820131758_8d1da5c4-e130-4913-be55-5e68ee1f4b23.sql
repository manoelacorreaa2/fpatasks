CREATE TABLE public.task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text,
  urgency task_urgency NOT NULL DEFAULT 'medium',
  recurrence task_recurrence NOT NULL DEFAULT 'one_off',
  impacts_margin boolean NOT NULL DEFAULT false,
  impact_type impact_type,
  estimated_impact_usd numeric NOT NULL DEFAULT 0,
  estimated_hours numeric,
  confidence integer NOT NULL DEFAULT 3,
  expected_output text,
  needs_review boolean NOT NULL DEFAULT false,
  trm task_trm,
  delegation_level integer,
  dod jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_templates_select_auth ON public.task_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY task_templates_insert_own ON public.task_templates
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY task_templates_update_own_or_admin ON public.task_templates
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY task_templates_delete_own_or_admin ON public.task_templates
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER task_templates_updated_at BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();