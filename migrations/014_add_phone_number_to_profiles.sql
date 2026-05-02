-- 1. Add phone column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Add contact columns to jobs to persist them at time of booking/claiming
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS worker_phone TEXT;