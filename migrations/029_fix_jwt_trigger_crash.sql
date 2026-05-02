-- Migration 033: Fix JWT Trigger Crash
-- This fixes the 'Silent Killer' trigger from Migration 010 that crashes 
-- during signup because no JWT exists yet.

CREATE OR REPLACE FUNCTION public.set_user_role_in_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_claims TEXT;
BEGIN
  -- 1. Safely check if we are in an active request with claims
  current_claims := current_setting('request.jwt.claims', true);

  -- 2. ONLY try to update if claims exist and are valid JSON
  -- This prevents the 'Database error saving user' during signup
  IF current_claims IS NOT NULL AND current_claims <> '' THEN
    BEGIN
      PERFORM set_config(
        'request.jwt.claims',
        jsonb_set(
          current_claims::jsonb,
          '{user_role}',
          to_jsonb(NEW.role)
        )::text,
        true
      );
    EXCEPTION WHEN OTHERS THEN
      -- If the claims aren't valid JSON, just ignore it and move on
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure it is correctly attached to profiles
DROP TRIGGER IF EXISTS set_user_role_jwt_trigger ON public.profiles;
CREATE TRIGGER set_user_role_jwt_trigger
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_user_role_in_jwt();
