-- 043_add_task_progress_to_jobs.sql
-- Adds tasks_completed_count to jobs so the employee's real checked-off count
-- is persisted when they submit for review, rather than derived from status in the UI.

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS tasks_completed_count INTEGER NOT NULL DEFAULT 0;

-- Backfill: any job already COMPLETED or PENDING_REVIEW should reflect all tasks done.
-- We read the tasks JSONB length for accuracy.
UPDATE public.jobs
SET tasks_completed_count = jsonb_array_length(tasks)
WHERE status IN ('COMPLETED', 'PENDING_REVIEW')
  AND tasks_completed_count = 0
  AND jsonb_array_length(tasks) > 0;
