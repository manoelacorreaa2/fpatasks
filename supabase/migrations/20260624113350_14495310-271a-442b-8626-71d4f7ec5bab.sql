
-- email_logs: admin-only SELECT
DROP POLICY IF EXISTS email_logs_select_auth ON public.email_logs;
CREATE POLICY email_logs_select_admin ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- kpi_snapshots: admin OR own user_id (NULL user_id = team-wide, admin only)
DROP POLICY IF EXISTS kpi_snapshots_select_auth ON public.kpi_snapshots;
CREATE POLICY kpi_snapshots_select_admin_or_self ON public.kpi_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- has_role: lock down EXECUTE — revoke from PUBLIC/anon, keep for authenticated and service_role
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
