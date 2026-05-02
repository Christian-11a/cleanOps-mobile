-- Migration 032: Emergency Signup Unification
-- This is the final fix for the "Web vs Mobile" signup war.
-- It handles every name format and NEVER uses EXCEPTION blocks.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  target_role TEXT := 'customer';
  final_name TEXT := '';
BEGIN
  -- 1. Identify Role (Flexible matching)
  IF (NEW.raw_user_meta_data->>'role') IS NOT NULL THEN
    IF LOWER(NEW.raw_user_meta_data->>'role') IN ('employee', 'cleaner', 'worker') THEN
      target_role := 'employee';
    END IF;
  END IF;

  -- 2. Build Name (Handle Web's "full_name" AND Mobile's "first_name/last_name")
  final_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
    'New User'
  );

  -- 3. The "No-Fail" Upsert
  -- We use a single, clean statement that matches the DB constraints perfectly.
  INSERT INTO public.profiles (id, email, role, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    target_role,
    NULLIF(TRIM(final_name), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
