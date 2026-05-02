-- 046_fix_transaction_logging_and_ratings.sql
-- 1. Update add_money RPC to log a transaction
-- 2. Update release_escrow RPC to log transactions
-- 3. Ensure rating updates account for both customer and employee roles
-- 4. Fix cancel_job to log refund transactions

-- -----------------------------------------------------------------------------
-- 1. Robust add_money with transaction logging
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_money(user_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  -- Security Check: Only the user can add to their own wallet (or an admin)
  IF auth.uid() != user_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: You can only add money to your own wallet.';
  END IF;

  UPDATE public.profiles SET money_balance = money_balance + amount WHERE id = user_id;
  
  -- LOG TRANSACTION
  INSERT INTO public.transactions (user_id, type, amount, payload)
  VALUES (user_id, 'TOP_UP', amount, jsonb_build_object('description', 'Wallet top-up via app'));

  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (user_id, 'money_added', json_build_object('amount', amount, 'description', 'Money added to your wallet'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 2. Robust release_escrow with transaction logging
-- -----------------------------------------------------------------------------
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
  SELECT customer_id, title INTO v_customer_id, v_job_title FROM public.jobs WHERE id = p_job_id;

  -- Security Check: Only the customer who owns the job, or an admin, can release escrow
  IF auth.uid() != v_customer_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only the customer can release funds for this job.';
  END IF;

  -- Get the first admin user
  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  -- Add payout to employee balance
  UPDATE public.profiles SET money_balance = money_balance + payout WHERE id = p_employee_id;
  
  -- LOG PAYOUT TRANSACTION (Employee)
  INSERT INTO public.transactions (user_id, type, amount, payload)
  VALUES (p_employee_id, 'PAYOUT', payout, jsonb_build_object('job_id', p_job_id, 'job_title', v_job_title));

  -- Add platform fee to admin balance if admin exists
  IF admin_id IS NOT NULL THEN
    UPDATE public.profiles SET money_balance = money_balance + p_platform_fee WHERE id = admin_id;
    -- LOG REVENUE TRANSACTION (Admin)
    INSERT INTO public.transactions (user_id, type, amount, payload)
    VALUES (admin_id, 'PAYMENT', p_platform_fee, jsonb_build_object('job_id', p_job_id, 'type', 'platform_fee'));
  END IF;
  
  -- LOG PAYMENT TRANSACTION (Customer)
  -- Note: The money was already deducted from balance when the job was created (escrowed)
  -- but we log the 'PAYMENT' record now to show in their history as a completed expenditure.
  INSERT INTO public.transactions (user_id, type, amount, payload)
  VALUES (v_customer_id, 'PAYMENT', p_amount, jsonb_build_object('job_id', p_job_id, 'job_title', v_job_title));

  -- Add notification for employee
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (p_employee_id, 'payout_received', jsonb_build_object('job_id', p_job_id, 'amount', payout, 'platform_fee', p_platform_fee));

  -- Add notification for customer
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (
    v_customer_id,
    'payout_sent',
    jsonb_build_object('job_id', p_job_id, 'amount', payout, 'platform_fee', p_platform_fee)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 3. Robust Rating Trigger (Ensures both roles are updated)
-- -----------------------------------------------------------------------------
-- This fixes the issue where satisfaction might not update if the logic was too narrow.
CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Reviewee rating
    UPDATE public.profiles
    SET rating = (SELECT AVG(rating)::NUMERIC(3,2) FROM public.reviews WHERE reviewee_id = NEW.reviewee_id)
    WHERE id = NEW.reviewee_id;

    -- Update Reviewer reviews_given count
    UPDATE public.profiles
    SET reviews_given = (SELECT COUNT(*) FROM public.reviews WHERE reviewer_id = NEW.reviewer_id)
    WHERE id = NEW.reviewer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 4. Transaction Logging for Job Refunds (on Cancellation)
-- -----------------------------------------------------------------------------
-- We need to ensure that when a job is cancelled, the refund is logged.
-- This depends on how cancel_job is implemented. If it's a client-side update,
-- we should ideally move it to an RPC. For now, let's add a trigger on jobs
-- that logs a REFUND if status moves to CANCELLED and money was involved.

CREATE OR REPLACE FUNCTION log_job_refund()
RETURNS TRIGGER AS $$
BEGIN
    -- If job status changed to CANCELLED and it was previously OPEN/IN_PROGRESS/PENDING_REVIEW
    -- And it has a price (meaning money was escrowed)
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' AND NEW.price_amount > 0 THEN
        -- Log refund for customer
        INSERT INTO public.transactions (user_id, type, amount, payload)
        VALUES (NEW.customer_id, 'REFUND', NEW.price_amount, jsonb_build_object('job_id', NEW.id, 'job_title', NEW.title));
        
        -- The actual balance update happens in the application code, 
        -- but logging it here ensures the history reflects it.
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_job_refund ON public.jobs;
CREATE TRIGGER trg_log_job_refund
    AFTER UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_job_refund();
