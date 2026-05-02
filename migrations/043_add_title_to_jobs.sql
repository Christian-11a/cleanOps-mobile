-- 040_add_title_to_jobs.sql
-- Adds a title column to the jobs table for better descriptive names (e.g., "Kitchen Deep Clean").

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill existing jobs with a default title based on their type/size if needed, 
-- or leave as NULL which is also fine.
