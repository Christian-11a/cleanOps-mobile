-- Migration 022: Create payment_methods table
-- Stores mock payment details for customers (Safe mockup data).

CREATE TYPE payment_method_type AS ENUM ('card', 'e-wallet');

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        payment_method_type NOT NULL,
  brand       TEXT NOT NULL, -- 'Visa', 'Mastercard', 'GCash', 'Maya'
  last4       TEXT,          -- Only for cards
  expiry      TEXT,          -- Only for cards
  phone_number TEXT,         -- Only for e-wallets
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON public.payment_methods(user_id);

-- RLS: Users can manage their own payment methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods"
  ON public.payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own payment methods"
  ON public.payment_methods FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.payment_methods IS 'Stores mockup payment tokens for customer wallet top-ups';
