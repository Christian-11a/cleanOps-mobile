-- Migration 039: Fix Infinite Recursion on Profile Load
--
-- Problem: Migration 038 added 'applicants_can_see_jobs' on the jobs table which queries 'job_applications'.
-- Migration 037 added 'applications_select_customer_v2' on 'job_applications' which queries 'jobs'.
-- This creates a closed loop: jobs -> job_applications -> jobs -> ...
-- When this happens, Postgres throws a stack overflow error on ANY query to jobs or profiles,
-- causing the UI to show blank names (since getProfile returns null).
--
-- Fix: Drop the cyclic policy from 038 (it's unnecessary anyway since OPEN jobs are visible to everyone)
-- and use SECURITY DEFINER functions for the remaining cross-table checks to guarantee no recursion.

-- 1. Drop the dangerous cyclic policy from migration 038
DROP POLICY IF EXISTS "applicants_can_see_jobs" ON public.jobs;

-- 2. Make the job_applications customer check safe via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_job_customer(p_job_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = p_job_id AND customer_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "applications_select_customer" ON public.job_applications;
DROP POLICY IF EXISTS "applications_select_customer_v2" ON public.job_applications;
CREATE POLICY "applications_select_customer_v3"
    ON public.job_applications FOR SELECT
    USING (public.is_job_customer(job_id, auth.uid()));

-- 3. Make the profiles chat check safe as well (from migration 023)
CREATE OR REPLACE FUNCTION public.is_job_participant(p_job_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = p_job_id AND (customer_id = p_user_id OR worker_id = p_user_id)
  );
$$;

DROP POLICY IF EXISTS "profiles_read_chat" ON public.profiles;
CREATE POLICY "profiles_read_chat_v2" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.sender_id = profiles.id
      AND public.is_job_participant(m.job_id, auth.uid())
  )
);
