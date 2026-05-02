-- 044_fix_triggers_and_notifications.sql
-- 1. Ensure reviews_given is updated for customers
-- 2. Ensure rating is correctly averaged and updated for employees
-- 3. Add notifications for Job Applications and Proof Submission
-- 4. Fix rating notification star display logic

-- Add reviews_given column if not exists (safety)
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS reviews_given INTEGER DEFAULT 0;

-- Function to update profile stats (Rating and Reviews Given)
CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Reviewee (usually Employee) rating and total jobs
    -- CHANGED: updated to total_jobs to match the frontend column
    UPDATE public.profiles
    SET 
        rating = (SELECT AVG(rating)::NUMERIC(3,2) FROM public.reviews WHERE reviewee_id = NEW.reviewee_id),
        total_jobs = (SELECT COUNT(*) FROM public.jobs WHERE worker_id = NEW.reviewee_id AND status = 'COMPLETED')
    WHERE id = NEW.reviewee_id;

    -- Update Reviewer (usually Customer) reviews_given count
    UPDATE public.profiles
    SET reviews_given = (SELECT COUNT(*) FROM public.reviews WHERE reviewer_id = NEW.reviewer_id)
    WHERE id = NEW.reviewer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-link trigger
DROP TRIGGER IF EXISTS on_review_added ON public.reviews;
CREATE TRIGGER on_review_added
    AFTER INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats();

-- Notification Trigger for Job Applications
CREATE OR REPLACE FUNCTION notify_on_job_application()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_applicant_name TEXT;
BEGIN
    SELECT customer_id INTO v_customer_id FROM public.jobs WHERE id = NEW.job_id;
    SELECT full_name INTO v_applicant_name FROM public.profiles WHERE id = NEW.employee_id;

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
        v_customer_id,
        'job_claimed',
        jsonb_build_object(
            'job_id', NEW.job_id,
            'applicant_name', COALESCE(v_applicant_name, 'A cleaner')
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_job_application ON public.job_applications;
CREATE TRIGGER on_job_application
    AFTER INSERT ON public.job_applications
    FOR EACH ROW EXECUTE FUNCTION notify_on_job_application();

-- Notification Trigger for Job Completion (Proof Submitted)
CREATE OR REPLACE FUNCTION notify_on_proof_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_worker_name TEXT;
BEGIN
    -- This trigger handles when a job moves to PENDING_REVIEW (worker submitted proof)
    IF NEW.status = 'PENDING_REVIEW' AND OLD.status = 'IN_PROGRESS' THEN
        SELECT customer_id INTO v_customer_id FROM public.jobs WHERE id = NEW.id;
        SELECT full_name INTO v_worker_name FROM public.profiles WHERE id = NEW.worker_id;

        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (
            v_customer_id,
            'proof_submitted',
            jsonb_build_object(
                'job_id', NEW.id,
                'worker_name', COALESCE(v_worker_name, 'Your cleaner')
            )
        );
    END IF;
    
    -- Also update total_jobs if it just hit COMPLETED
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' AND NEW.worker_id IS NOT NULL THEN
        UPDATE public.profiles
        SET total_jobs = (SELECT COUNT(*) FROM public.jobs WHERE worker_id = NEW.worker_id AND status = 'COMPLETED')
        WHERE id = NEW.worker_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_job_status_change_notify ON public.jobs;
CREATE TRIGGER on_job_status_change_notify
    AFTER UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION notify_on_proof_submission();

-- Fix the existing review notification trigger to show actual rating
CREATE OR REPLACE FUNCTION notify_on_review()
RETURNS TRIGGER AS $$
DECLARE
  v_reviewer_name TEXT;
BEGIN
  SELECT full_name INTO v_reviewer_name
  FROM public.profiles
  WHERE id = NEW.reviewer_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.reviewee_id,
    'new_review',
    jsonb_build_object(
      'job_id',        NEW.job_id,
      'rating',        NEW.rating,
      'reviewer_name', COALESCE(v_reviewer_name, 'A customer')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
