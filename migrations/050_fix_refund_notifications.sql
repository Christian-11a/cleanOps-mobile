-- 050_fix_refund_notifications.sql
-- 1. Update add_money RPC to support custom types and descriptions
-- 2. Prevent triple-logging by disabling the redundant job refund trigger
-- 3. Ensure "Money Refunded" notification is sent correctly

-- 1. Updated add_money RPC
CREATE OR REPLACE FUNCTION add_money(
  user_id uuid, 
  amount numeric, 
  p_type text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_type text;
  v_notif_type text;
  v_description text;
BEGIN
  -- Security Check: Only the user can add to their own wallet (or an admin)
  IF auth.uid() != user_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: You can only update your own wallet.';
  END IF;

  -- Update Balance
  UPDATE public.profiles SET money_balance = money_balance + amount WHERE id = user_id;

  -- 1. Determine Transaction Type
  IF p_type IS NOT NULL THEN
    v_type := p_type;
  ELSIF amount > 0 THEN
    v_type := 'TOP_UP';
  ELSE
    v_type := 'WITHDRAWAL';
  END IF;

  -- 2. Determine Notification Type
  IF v_type = 'REFUND' THEN
    v_notif_type := 'refund';
  ELSIF v_type = 'WITHDRAWAL' THEN
    v_notif_type := 'withdrawal';
  ELSE
    v_notif_type := 'money_added';
  END IF;

  -- 3. Determine Description
  IF p_description IS NOT NULL THEN
    v_description := p_description;
  ELSIF v_type = 'REFUND' THEN
    v_description := 'Money Refunded';
  ELSIF v_type = 'TOP_UP' THEN
    v_description := 'Funds Deposited';
  ELSIF v_type = 'WITHDRAWAL' THEN
    v_description := 'Funds Withdrawn';
  ELSE
    v_description := 'Wallet Update';
  END IF;

  -- LOG TRANSACTION
  -- We include the description in the payload for UI display
  INSERT INTO public.transactions (user_id, type, amount, payload)
  VALUES (user_id, v_type, amount, jsonb_build_object('description', v_description));

  -- SEND NOTIFICATION
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (
    user_id, 
    v_notif_type, 
    jsonb_build_object(
      'amount', ABS(amount), 
      'description', v_description,
      'title', v_description -- Include title in payload as well
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Disable the redundant trigger from migration 046 to prevent double/triple logging
-- Since the application now calls add_money with type='REFUND', the RPC handles logging.
DROP TRIGGER IF EXISTS trg_log_job_refund ON public.jobs;
DROP FUNCTION IF EXISTS log_job_refund();
