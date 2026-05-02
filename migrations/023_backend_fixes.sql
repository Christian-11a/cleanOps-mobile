-- Migration 023: Backend Security and Schema Fixes
-- Addresses payment methods schema, insecure RPCs, location RPC drift, and the profile data leak.

-- 1. Fix Wallet Schema (Missing cardholder_name)
ALTER TABLE public.payment_methods 
ADD COLUMN IF NOT EXISTS cardholder_name TEXT;

-- 2. Secure RPCs (add_money, claim_job, release_escrow)
CREATE OR REPLACE FUNCTION add_money(user_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  -- Security Check: Only the user can add to their own wallet (or an admin)
  IF auth.uid() != user_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: You can only add money to your own wallet.';
  END IF;

  UPDATE public.profiles SET money_balance = money_balance + amount WHERE id = user_id;
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (user_id, 'money_added', json_build_object('amount', amount, 'description', 'Mock money added'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid, p_employee_id uuid)
RETURNS uuid AS $$
DECLARE
  employee_name text;
BEGIN
  -- Security Check: Only the authenticated employee can claim a job for themselves
  IF auth.uid() != p_employee_id THEN
    RAISE EXCEPTION 'Unauthorized: You cannot claim a job for another employee.';
  END IF;

  -- Get employee's name
  SELECT full_name INTO employee_name FROM public.profiles WHERE id = p_employee_id;

  -- Check if job is still open
  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id AND status = 'OPEN') THEN
    RAISE EXCEPTION 'Job is no longer available';
  END IF;

  -- Update job with employee and change status
  UPDATE public.jobs
  SET worker_id = p_employee_id, worker_name = employee_name, status = 'IN_PROGRESS', updated_at = now()
  WHERE id = p_job_id AND status = 'OPEN';

  -- Notify customer
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (
    (SELECT customer_id FROM public.jobs WHERE id = p_job_id),
    'job_claimed',
    json_build_object('job_id', p_job_id, 'employee_id', p_employee_id)
  );

  RETURN p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION release_escrow(
  p_job_id uuid,
  p_employee_id uuid,
  p_amount numeric,
  p_platform_fee numeric
)
RETURNS void AS $$
DECLARE
  payout numeric := p_amount - p_platform_fee;
  admin_id uuid;
  v_customer_id uuid;
BEGIN
  SELECT customer_id INTO v_customer_id FROM public.jobs WHERE id = p_job_id;
  
  -- Security Check: Only the customer who owns the job, or an admin, can release escrow
  IF auth.uid() != v_customer_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only the customer can release funds for this job.';
  END IF;

  -- Get the first admin user
  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  -- Add payout to employee balance
  UPDATE public.profiles SET money_balance = money_balance + payout WHERE id = p_employee_id;

  -- Add platform fee to admin balance if admin exists
  IF admin_id IS NOT NULL THEN
    UPDATE public.profiles SET money_balance = money_balance + p_platform_fee WHERE id = admin_id;
  END IF;

  -- Add notification for employee
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (p_employee_id, 'payout_received', json_build_object('job_id', p_job_id, 'amount', payout, 'platform_fee', p_platform_fee));

  -- Add notification for customer
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (
    v_customer_id,
    'payout_sent',
    json_build_object('job_id', p_job_id, 'amount', payout, 'platform_fee', p_platform_fee)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix Location RPC (get_nearby_jobs)
-- Drop the old signature that relied on PostGIS coordinates
DROP FUNCTION IF EXISTS get_nearby_jobs(double precision, double precision, double precision);

-- Create new signature relying on the new 'distance' column
CREATE OR REPLACE FUNCTION get_nearby_jobs(
  radius_km double precision DEFAULT 50
)
RETURNS SETOF public.jobs AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.jobs
  WHERE status = 'OPEN'
    AND distance <= radius_km
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Plug the Profile Data Leak
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

-- Create stricter read policies:
-- A user can read their own profile
CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "profiles_read_admin" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Customers and Employees can read each other's profiles if they are part of the same job.
CREATE POLICY "profiles_read_shared_job" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE (customer_id = auth.uid() AND worker_id = profiles.id)
       OR (worker_id = auth.uid() AND customer_id = profiles.id)
  )
);

-- Customers can read profiles of employees who applied to their job
CREATE POLICY "profiles_read_applicants" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.job_applications ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.employee_id = profiles.id AND j.customer_id = auth.uid()
  )
);

-- Allow reading profiles for chat messages
CREATE POLICY "profiles_read_chat" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.jobs j ON m.job_id = j.id
    WHERE m.sender_id = profiles.id 
      AND (j.customer_id = auth.uid() OR j.worker_id = auth.uid())
  )
);
