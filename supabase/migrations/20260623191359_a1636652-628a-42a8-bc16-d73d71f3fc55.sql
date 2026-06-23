DROP VIEW public.tasks_with_score;
CREATE VIEW public.tasks_with_score AS
SELECT t.*,
  CASE WHEN impacts_margin THEN 2.0 ELSE 1.0 END AS s_reach,
  LEAST(GREATEST(estimated_impact_usd / 50000.0, 0.25), 3.0) AS s_impact_norm,
  confidence::numeric / 5.0 AS s_confidence_n,
  GREATEST(COALESCE(estimated_hours, 4::numeric), 0.5) AS s_effort,
  CASE urgency WHEN 'low' THEN 1.0 WHEN 'medium' THEN 1.3 WHEN 'high' THEN 1.7 WHEN 'critical' THEN 2.2 END AS s_urgency_mult,
  CASE WHEN deadline IS NULL THEN 1.0 ELSE 1.0 + GREATEST(0, 7 - (deadline - CURRENT_DATE))::numeric / 7.0 * 0.5 END AS s_deadline_mult,
  (CASE WHEN impacts_margin THEN 2.0 ELSE 1.0 END
    * LEAST(GREATEST(estimated_impact_usd / 50000.0, 0.25), 3.0)
    * (confidence::numeric / 5.0)
    / GREATEST(COALESCE(estimated_hours, 4::numeric), 0.5)
    * CASE urgency WHEN 'low' THEN 1.0 WHEN 'medium' THEN 1.3 WHEN 'high' THEN 1.7 WHEN 'critical' THEN 2.2 END
    * CASE WHEN deadline IS NULL THEN 1.0 ELSE 1.0 + GREATEST(0, 7 - (deadline - CURRENT_DATE))::numeric / 7.0 * 0.5 END
  ) AS score,
  CASE WHEN deadline IS NOT NULL AND deadline < CURRENT_DATE AND status <> 'done' THEN true ELSE false END AS is_overdue
FROM public.tasks t;
GRANT SELECT ON public.tasks_with_score TO authenticated;