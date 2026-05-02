-- 042_fix_rating_trigger_security.sql
-- The update_profile_rating() function in migration 037 was missing SECURITY DEFINER.
-- Without it, the trigger runs in the customer's RLS context. The profiles_update_own
-- policy (auth.uid() = id) blocks updating the employee's profile row because
-- auth.uid() = customer, not employee → 0 rows updated, no error, rating never saved.
--
-- Fix: recreate the function with SECURITY DEFINER so it bypasses RLS.

CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET rating = (
        SELECT AVG(rating)::NUMERIC(3,2)
        FROM public.reviews
        WHERE reviewee_id = NEW.reviewee_id
    )
    WHERE id = NEW.reviewee_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
