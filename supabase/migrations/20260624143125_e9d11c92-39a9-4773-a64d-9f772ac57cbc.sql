
CREATE OR REPLACE FUNCTION public.tasks_clone_on_recurrence_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_date date;
  next_deadline date;
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

    INSERT INTO public.tasks (
      assignee_id, created_by, title, description, status, urgency, deadline,
      impacts_margin, estimated_hours, expected_output, impact_type,
      estimated_impact_usd, actual_impact_usd, confidence, needs_review,
      reviewer_id, review_status, is_blocked, blocked_reason, recurrence
    ) VALUES (
      NEW.assignee_id, NEW.created_by, NEW.title, NEW.description, 'todo',
      NEW.urgency, next_deadline, NEW.impacts_margin, NEW.estimated_hours,
      NEW.expected_output, NEW.impact_type, NEW.estimated_impact_usd,
      NULL, NEW.confidence, NEW.needs_review, NEW.reviewer_id, 'pending',
      false, NULL, NEW.recurrence
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_clone_on_recurrence_done_trg ON public.tasks;
CREATE TRIGGER tasks_clone_on_recurrence_done_trg
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.tasks_clone_on_recurrence_done();
