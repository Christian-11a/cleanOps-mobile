-- Migration 052: Create hold_escrow RPC
--
-- This function is called when a customer posts a job.
-- It deducts the price from their balance, logs a transaction, 
-- and sends a notification.

CREATE OR REPLACE FUNCTION hold_escrow(
  p_job_id uuid,
  p_customer_id uuid,
  p_amount numeric
)
RETURNS void AS $$
DECLARE
  v_job_title text;
BEGIN
  -- 1. Get job title for the transaction log
  SELECT title INTO v_job_title FROM public.jobs WHERE id = p_job_id;

  -- 2. Deduct money from customer's balance
  UPDATE public.profiles
  SET money_balance = money_balance - p_amount
  WHERE id = p_customer_id;

  -- 3. Log the transaction
  INSERT INTO public.transactions (user_id, type, amount, payload)
  VALUES (
    p_customer_id, 
    'PAYMENT', 
    -p_amount, 
    jsonb_build_object(
      'job_id', p_job_id, 
      'description', 'Job Escrow Payment',
      'job_title', v_job_title,
      'status', 'escrowed'
    )
  );

  -- 4. Send notification
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    p_customer_id,
    'job_posted',
    jsonb_build_object(
      'job_id', p_job_id,
      'amount', p_amount,
      'title', v_job_title
    )
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
