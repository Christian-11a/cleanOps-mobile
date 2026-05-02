-- Migration 024: Approve Job Application RPC
-- Allows a customer to approve an employee's application, transitioning the job to IN_PROGRESS.
-- This is needed because claim_job (023) enforces that only the employee can call it for themselves.

CREATE OR REPLACE FUNCTION approve_job_application(p_job_id uuid, p_employee_id uuid)
RETURNS void AS $$
DECLARE
  v_customer_id uuid;
  v_employee_name text;
  v_employee_phone text;
BEGIN
  SELECT customer_id INTO v_customer_id FROM public.jobs WHERE id = p_job_id;

  -- Only the owning customer can approve
  IF auth.uid() != v_customer_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the customer can approve applications.';
  END IF;

  -- Fetch applicant details
  SELECT full_name, phone INTO v_employee_name, v_employee_phone
  FROM public.profiles WHERE id = p_employee_id;

  IF v_employee_name IS NULL THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;

  -- Assign worker and move to IN_PROGRESS
  UPDATE public.jobs
  SET
    worker_id    = p_employee_id,
    worker_name  = v_employee_name,
    worker_phone = v_employee_phone,
    status       = 'IN_PROGRESS',
    updated_at   = now()
  WHERE id = p_job_id AND status = 'OPEN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer open for approval.';
  END IF;

  -- Notify the approved employee
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (
    p_employee_id,
    'application_approved',
    json_build_object('job_id', p_job_id, 'message', 'Your application was approved! The job is now In Progress.')
  );

  -- Notify the customer (confirmation)
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (
    v_customer_id,
    'cleaner_approved',
    json_build_object('job_id', p_job_id, 'employee_name', v_employee_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
