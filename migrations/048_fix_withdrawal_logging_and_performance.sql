-- 048_fix_withdrawal_logging_and_performance.sql
-- 1. Update transactions type constraint to allow WITHDRAWAL
-- 2. Robust add_money with correct type logging and better descriptions

-- 1. Relax the check constraint on transactions type
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('REFUND', 'PAYMENT', 'PAYOUT', 'TOP_UP', 'WITHDRAWAL'));

-- 2. Update add_money RPC with logic for withdrawal vs top-up
CREATE OR REPLACE FUNCTION add_money(user_id uuid, amount numeric)
RETURNS void AS $$
DECLARE
  v_type text;
  v_description text;
BEGIN
  -- Security Check: Only the user can add to their own wallet (or an admin)
  IF auth.uid() != user_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: You can only add money to your own wallet.';
  END IF;

  UPDATE public.profiles SET money_balance = money_balance + amount WHERE id = user_id;
  
  -- Logic to determine transaction type and user-friendly description
  IF amount > 0 THEN
    v_type := 'TOP_UP';
    v_description := 'Funds Deposited';
  ELSE
    v_type := 'WITHDRAWAL';
    v_description := 'Funds Withdrawn';
  END IF;

  -- LOG TRANSACTION (Using description in payload for the UI)
  INSERT INTO public.transactions (user_id, type, amount, payload)
  VALUES (user_id, v_type, amount, jsonb_build_object('description', v_description));

  -- NOTIFY
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (user_id, CASE WHEN amount > 0 THEN 'money_added' ELSE 'withdrawal' END, json_build_object('amount', ABS(amount), 'description', v_description));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
