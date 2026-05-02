-- Migration 027: Allow employees to apply for open jobs
--
-- Problem: applyForJob does an UPDATE on the jobs table but no RLS policy
-- allows an employee to update a job they don't yet own. The update silently
-- affects 0 rows — employee sees "Application sent!" but nothing was saved.
-- The customer then sees no applicant name and worker_id is always null,
-- breaking the Approve & Hire flow entirely.
--
-- Fix: Add an UPDATE policy that lets any authenticated non-customer user
-- update an OPEN job that has no worker yet. The worker_id column is used
-- to track the applicant (prevents double-applying). The WITH CHECK ensures
-- the employee cannot also change the job status in the same call.

CREATE POLICY "employees_can_apply_to_open_jobs"
  ON public.jobs FOR UPDATE
  USING (
    status = 'OPEN'
    AND worker_id IS NULL
    AND auth.uid() != customer_id
  )
  WITH CHECK (
    status = 'OPEN'
  );
