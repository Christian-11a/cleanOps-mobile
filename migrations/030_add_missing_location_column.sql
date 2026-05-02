-- Migration 034: Ensure location_address column exists in profiles
-- This fixes the "Could not find column" error during profile updates.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Refresh PostgREST cache (Supabase internal)
NOTIFY pgrst, 'reload schema';
