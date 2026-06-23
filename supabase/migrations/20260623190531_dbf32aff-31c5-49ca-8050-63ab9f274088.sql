
-- 1. Recreate view with security_invoker
DROP VIEW IF EXISTS public.tasks_with_score;
CREATE VIEW public.tasks_with_score WITH (security_invoker=true) AS
SELECT
  t.*,
  CASE WHEN t.impacts_margin THEN 2.0 ELSE 1.0 END AS s_reach,
  LEAST(GREATEST(t.estimated_impact_usd / 50000.0, 0.25), 3.0) AS s_impact_norm,
  (t.confidence::numeric / 5.0) AS s_confidence_n,
  GREATEST(COALESCE(t.estimated_hours, 4), 0.5) AS s_effort,
  CASE t.urgency WHEN 'low' THEN 1.0 WHEN 'medium' THEN 1.3 WHEN 'high' THEN 1.7 WHEN 'critical' THEN 2.2 END AS s_urgency_mult,
  CASE WHEN t.deadline IS NULL THEN 1.0
       ELSE 1.0 + GREATEST(0, (7 - (t.deadline - CURRENT_DATE))) / 7.0 * 0.5 END AS s_deadline_mult,
  (
    CASE WHEN t.impacts_margin THEN 2.0 ELSE 1.0 END
    * LEAST(GREATEST(t.estimated_impact_usd / 50000.0, 0.25), 3.0)
    * (t.confidence::numeric / 5.0)
    / GREATEST(COALESCE(t.estimated_hours, 4), 0.5)
    * CASE t.urgency WHEN 'low' THEN 1.0 WHEN 'medium' THEN 1.3 WHEN 'high' THEN 1.7 WHEN 'critical' THEN 2.2 END
    * CASE WHEN t.deadline IS NULL THEN 1.0
           ELSE 1.0 + GREATEST(0, (7 - (t.deadline - CURRENT_DATE))) / 7.0 * 0.5 END
  ) AS score,
  CASE WHEN t.deadline IS NOT NULL AND t.deadline < CURRENT_DATE AND t.status <> 'done' THEN true ELSE false END AS is_overdue
FROM public.tasks t;
GRANT SELECT ON public.tasks_with_score TO authenticated;
GRANT SELECT ON public.tasks_with_score TO service_role;

-- 2. Tighten task policies
DROP POLICY IF EXISTS "tasks_update_auth" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_auth" ON public.tasks;
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_delete_auth" ON public.tasks FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
