-- 041_fix_review_trigger.sql
-- Fix 1: update_profile_rating trigger references two non-existent things:
--   a) jobs.employee_id (table uses worker_id)
--   b) profiles.jobs_completed (column was never created in any migration)
-- Fix: only update 'rating', which does exist in profiles.
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
$$ LANGUAGE plpgsql;

-- Fix 2: disputes admin SELECT policy in migration 040 queries profiles directly
-- inside an RLS policy → potential recursion. Replace with is_admin_user() SECURITY DEFINER.
DROP POLICY IF EXISTS "Admins can view all disputes" ON public.disputes;
CREATE POLICY "Admins can view all disputes" ON public.disputes
    FOR SELECT USING (is_admin_user(auth.uid()));

-- Fix 3: reviews INSERT policy should also verify the job is COMPLETED
-- and the reviewer is actually the customer of that job (prevents employees from rating themselves).
DROP POLICY IF EXISTS "Users can create reviews for their jobs" ON public.reviews;
CREATE POLICY "Users can create reviews for their jobs" ON public.reviews
    FOR INSERT WITH CHECK (
        auth.uid() = reviewer_id
        AND EXISTS (
            SELECT 1 FROM public.jobs
            WHERE id = job_id
              AND customer_id = auth.uid()
              AND status = 'COMPLETED'
        )
    );
