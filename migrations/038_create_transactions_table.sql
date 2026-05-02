-- 042_create_transactions_table.sql
-- Creates the transactions table referenced by cancelJob (actions/jobs.ts) but never defined.
-- Without this, every job cancellation silently swallows a Supabase error.

CREATE TABLE IF NOT EXISTS public.transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('REFUND', 'PAYMENT', 'PAYOUT', 'TOP_UP')),
    amount      NUMERIC(12,2) NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id    ON public.transactions(user_id);
CREATE INDEX idx_transactions_type       ON public.transactions(type);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own transactions
CREATE POLICY "transactions_select_own"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Only server-side (SECURITY DEFINER RPCs) or the user themselves can insert
CREATE POLICY "transactions_insert_own"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can read all transactions
CREATE POLICY "transactions_select_admin"
    ON public.transactions FOR SELECT
    USING (is_admin_user(auth.uid()));
