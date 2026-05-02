-- Migration 053: Fix platform_config visibility for Mobile App
--
-- Problem: The platform_config table is restricted to authenticated users.
-- This causes the mobile app to fail reading the fee (PGRST116) if the session
-- is not perfectly initialized, or due to RLS sync delays.
--
-- Fix: Allow anyone (public) to SELECT from platform_config. 
-- This is safe because platform fees and public configurations are not sensitive.
-- This does NOT allow public users to UPDATE or DELETE.

-- 1. Remove the old restrictive read policy
DROP POLICY IF EXISTS "platform_config_read_all" ON public.platform_config;
DROP POLICY IF EXISTS "admin_only_platform_config" ON public.platform_config;

-- 2. Create a public read policy
CREATE POLICY "platform_config_public_read"
  ON public.platform_config
  FOR SELECT
  TO public
  USING (true);

-- 3. Ensure Admin-only Write access remains strictly enforced
-- (This ensures your Admin Dashboard still works and stays secure)
DROP POLICY IF EXISTS "admin_all_platform_config" ON public.platform_config;
CREATE POLICY "admin_all_platform_config"
  ON public.platform_config
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );
