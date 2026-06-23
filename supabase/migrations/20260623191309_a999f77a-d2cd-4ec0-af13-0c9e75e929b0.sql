CREATE TYPE task_recurrence AS ENUM ('one_off', 'daily', 'weekly', 'monthly');
ALTER TABLE public.tasks ADD COLUMN recurrence task_recurrence NOT NULL DEFAULT 'one_off';