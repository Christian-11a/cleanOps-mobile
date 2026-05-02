-- Migration 025: Fix RLS infinite recursion re-introduced by migration 023
--
-- Root cause: profiles_read_admin queries the profiles table from inside a
-- profiles SELECT policy → PostgreSQL evaluates all SELECT policies on the
-- inner query too → infinite recursion → stack overflow → ALL profile reads fail.
--
-- Symptom: getProfile() always returns null, users see "good morning User",
-- profiles appear not to save (update succeeds but refresh silently fails).
--
-- Fix: Use the SECURITY DEFINER helper `is_admin_user()` created in migration 010.
-- It runs as the postgres role, bypasses RLS, no recursion possible.

-- 1. Drop the recursive policy from migration 023
DROP POLICY IF EXISTS "profiles_read_admin" ON public.profiles;

-- 2. Drop duplicate own-read policies (migration 023 and 010 both added duplicates
--    of the profiles_select_own already in migration 002; extra policies are harmless
--    but messy — clean them up).
DROP POLICY IF EXISTS "profiles_read_own"  ON public.profiles;
DROP POLICY IF EXISTS "users_own_profile"  ON public.profiles;

-- 3. Recreate admin read policy without recursion
--    is_admin_user() is a SECURITY DEFINER function from migration 010 that
--    queries profiles as the postgres superuser, bypassing RLS entirely.
CREATE POLICY "profiles_read_admin" ON public.profiles
  FOR SELECT USING (is_admin_user(auth.uid()));

-- 4. Ensure the trigger that syncs new-signup emails into profiles exists.
--    Migration 019 added it for UPDATE but not for INSERT (new signups).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
