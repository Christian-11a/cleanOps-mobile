-- 041_fix_task_count_backfill.sql
-- Migration 043 backfilled tasks_completed_count using jsonb_array_length(tasks),
-- which incorrectly counted metadata objects (type='size', type='instruction')
-- that parseTasks() filters out on the frontend.
--
-- Example: a job with 9 real tasks + 1 size obj + 1 instruction obj
-- got tasks_completed_count=11, but the card shows 9 tasks → "11/9 tasks".
--
-- Fix: recount using only entries that are strings OR non-metadata objects.

UPDATE public.jobs
SET tasks_completed_count = (
  SELECT COUNT(*)::INTEGER
  FROM jsonb_array_elements(tasks) AS elem
  WHERE
    jsonb_typeof(elem) = 'string'
    OR (
      jsonb_typeof(elem) = 'object'
      AND (elem->>'type') IS DISTINCT FROM 'size'
      AND (elem->>'type') IS DISTINCT FROM 'instruction'
    )
)
WHERE status IN ('COMPLETED', 'PENDING_REVIEW')
  AND jsonb_array_length(tasks) > 0;

-- Cancelled jobs had 0 tasks completed — reset any incorrect values
UPDATE public.jobs
SET tasks_completed_count = 0
WHERE status = 'CANCELLED';
