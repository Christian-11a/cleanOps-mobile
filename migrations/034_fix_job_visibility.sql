-- Migration 038: Fix job visibility for employees
-- 
-- Problem: Employees cannot see OPEN jobs in the feed because the RLS policies 
-- only allowed customers to see their own jobs and workers to see jobs they 
-- were already assigned to.
--
-- Fix: Add a policy that allows any authenticated user to view jobs with 'OPEN' status.

-- First, ensure we don't have a naming conflict
DROP POLICY IF EXISTS "everyone_can_see_open_jobs" ON public.jobs;

-- Create the policy
CREATE POLICY "everyone_can_see_open_jobs"
  ON public.jobs FOR SELECT
  USING (status = 'OPEN');

-- Optional: Ensure employees can also see jobs they applied to (even if not assigned yet)
-- This is already partially covered by 'everyone_can_see_open_jobs' if status is OPEN,
-- but good for when the job transitions or for clarity.
DROP POLICY IF EXISTS "applicants_can_see_jobs" ON public.jobs;
CREATE POLICY "applicants_can_see_jobs"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications
      WHERE job_id = public.jobs.id
      AND employee_id = auth.uid()
    )
  );
