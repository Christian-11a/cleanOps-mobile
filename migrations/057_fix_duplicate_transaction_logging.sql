-- Migration 057: Fix Duplicate Transaction Logging
--
-- Problem: release_escrow was logging a second 'PAYMENT' transaction for the customer.
-- However, hold_escrow (Migration 052) already logs the 'PAYMENT' when the job is posted.
-- This caused the Customer's wallet history to show the deduction twice visually.
--
-- Fix: Redefine release_escrow to remove the redundant customer transaction log.
-- Note: We STRICTLY preserve the 'PAYOUT' for the Employee and 'PAYMENT' (Revenue) for the Admin.

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
  v_job_title text;
BEGIN
  -- 1. Get job details
  SELECT customer_id, title INTO v_customer_id, v_job_title FROM public.jobs WHERE id = p_job_id;

  -- 2. Security Check: Only the customer who owns the job, or an admin, can release escrow
  IF auth.uid() != v_customer_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only the customer can release funds for this job.';
  END IF;

  -- 3. Get the first admin user for fee collection
  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  -- 4. Add payout to employee balance
  UPDATE public.profiles SET money_balance = money_balance + payout WHERE id = p_employee_id;

  -- 5. LOG PAYOUT TRANSACTION (Employee)
  -- This shows up in the Cleaner's history as earnings.
  INSERT INTO public.transactions (user_id, type, amount, payload)
  VALUES (p_employee_id, 'PAYOUT', payout, jsonb_build_object('job_id', p_job_id, 'job_title', v_job_title));

  -- 6. Add platform fee to admin balance if admin exists
  IF admin_id IS NOT NULL THEN
    UPDATE public.profiles SET money_balance = money_balance + p_platform_fee WHERE id = admin_id;
    -- LOG REVENUE TRANSACTION (Admin)
    -- This shows up in the Admin's history as platform revenue.
    INSERT INTO public.transactions (user_id, type, amount, payload)
    VALUES (admin_id, 'PAYMENT', p_platform_fee, jsonb_build_object('job_id', p_job_id, 'type', 'platform_fee', 'job_title', v_job_title));
  END IF;

  -- [REMOVED] LOG PAYMENT TRANSACTION (Customer)
  -- We no longer log a second transaction here because Migration 052 (hold_escrow) 
  -- already logs the payment when the job is first created/posted.

  -- 7. Add notification for employee (Earnings)
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (p_employee_id, 'payout_received', jsonb_build_object('job_id', p_job_id, 'amount', payout, 'platform_fee', p_platform_fee));

  -- 8. Add notification for customer (Receipt)
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (
    v_customer_id,
    'payout_sent',
    jsonb_build_object('job_id', p_job_id, 'amount', payout, 'platform_fee', p_platform_fee)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
