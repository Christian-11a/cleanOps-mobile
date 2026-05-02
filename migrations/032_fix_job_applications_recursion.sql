-- Migration 036: Fix infinite recursion in job_applications policies
--
-- Problem: applications_insert_employee queries the profiles table, which has
-- recursive policies that query job_applications back, causing a stack overflow.
--
-- Fix: Use SECURITY DEFINER helper functions to check roles. These functions
-- run as the postgres user and bypass RLS, breaking the recursion cycle.

-- 1. Create helper functions if they don't exist
CREATE OR REPLACE FUNCTION public.is_employee(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'employee'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_customer(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'customer'
  );
$$;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "applications_select_employee" ON public.job_applications;
DROP POLICY IF EXISTS "applications_select_customer" ON public.job_applications;
DROP POLICY IF EXISTS "applications_insert_employee" ON public.job_applications;
DROP POLICY IF EXISTS "applications_update_customer" ON public.job_applications;
DROP POLICY IF EXISTS "applications_admin_all" ON public.job_applications;

-- 3. Recreate policies using helpers and avoiding direct recursive table lookups where possible

-- Employees can see their own applications
CREATE POLICY "applications_select_employee"
    ON public.job_applications FOR SELECT
    USING (auth.uid() = employee_id);

-- Customers can see applications for their jobs
-- Note: This queries the jobs table. Ensure jobs table SELECT policy is not recursive.
-- In migration 002, jobs_select is simple (auth.uid() = customer_id OR auth.uid() = worker_id OR status = 'OPEN')
CREATE POLICY "applications_select_customer"
    ON public.job_applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE id = job_applications.job_id 
            AND customer_id = auth.uid()
        )
    );

-- Employees can apply (insert)
CREATE POLICY "applications_insert_employee"
    ON public.job_applications FOR INSERT
    WITH CHECK (
        auth.uid() = employee_id 
        AND is_employee(auth.uid())
    );

-- Customers can update application status (ACCEPT/REJECT)
CREATE POLICY "applications_update_customer"
    ON public.job_applications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE id = job_applications.job_id 
            AND customer_id = auth.uid()
        )
    );

-- Admins have full access
CREATE POLICY "applications_admin_all"
    ON public.job_applications FOR ALL
    USING (is_admin_user(auth.uid()));
