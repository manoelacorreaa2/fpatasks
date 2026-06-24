
DROP POLICY IF EXISTS tasks_insert_auth ON public.tasks;
DROP POLICY IF EXISTS tasks_update_auth ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_auth ON public.tasks;

CREATE POLICY tasks_insert_admin_or_self ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR assignee_id = auth.uid()
  );

CREATE POLICY tasks_update_admin_or_self ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR assignee_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR assignee_id = auth.uid()
  );

CREATE POLICY tasks_delete_admin_or_self ON public.tasks
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR assignee_id = auth.uid()
  );
