-- Migration 037: Fix Applicant Visibility for Customers
--
-- Problem: Customers cannot see the profiles of employees who applied to their jobs
-- because the RLS policy was too complex or recursive.
--
-- Fix: Use a SECURITY DEFINER helper to verify the application exists.

-- 1. Helper to check application status without RLS interference
CREATE OR REPLACE FUNCTION public.has_applied_to_job(p_job_id UUID, p_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_applications
    WHERE job_id = p_job_id AND employee_id = p_employee_id
  );
$$;

-- 2. Update profiles policy
DROP POLICY IF EXISTS "profiles_read_applicants" ON public.profiles;

CREATE POLICY "profiles_read_applicants_v2" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.customer_id = auth.uid()
    AND public.has_applied_to_job(j.id, profiles.id)
  )
);

-- 3. Ensure applications table is readable by job owner
DROP POLICY IF EXISTS "applications_select_customer" ON public.job_applications;
DROP POLICY IF EXISTS "applications_select_customer_v2" ON public.job_applications;

CREATE POLICY "applications_select_customer_v2"
    ON public.job_applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE id = job_applications.job_id 
            AND customer_id = auth.uid()
        )
    );
