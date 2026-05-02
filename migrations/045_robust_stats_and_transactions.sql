-- 045_robust_stats_and_transactions.sql
-- 1. Add missing total_jobs column to profiles
-- 2. Automate "Jobs Completed" count updates on job status change
-- 3. Data Backfill (Synchronize counts)

-- -----------------------------------------------------------------------------
-- 1. Ensure columns exist
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reviews_given INTEGER DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 2. Job Completion Stats Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_employee_completed_count()
RETURNS TRIGGER AS $$
BEGIN
    -- If job status changed to COMPLETED, or a worker was assigned/changed on a completed job
    IF (NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED')) OR
       (NEW.status = 'COMPLETED' AND NEW.worker_id IS DISTINCT FROM OLD.worker_id) THEN
        
        -- Update the NEW worker's count
        IF NEW.worker_id IS NOT NULL THEN
            UPDATE public.profiles
            SET total_jobs = (SELECT COUNT(*) FROM public.jobs WHERE worker_id = NEW.worker_id AND status = 'COMPLETED')
            WHERE id = NEW.worker_id;
        END IF;

        -- If worker changed, update the OLD worker's count too
        IF OLD.worker_id IS NOT NULL AND OLD.worker_id IS DISTINCT FROM NEW.worker_id THEN
            UPDATE public.profiles
            SET total_jobs = (SELECT COUNT(*) FROM public.jobs WHERE worker_id = OLD.worker_id AND status = 'COMPLETED')
            WHERE id = OLD.worker_id;
        END IF;
    END IF;
    
    -- Also handle case where a COMPLETED job is cancelled or deleted
    IF (OLD.status = 'COMPLETED' AND NEW.status != 'COMPLETED') THEN
         UPDATE public.profiles
         SET total_jobs = (SELECT COUNT(*) FROM public.jobs WHERE worker_id = OLD.worker_id AND status = 'COMPLETED')
         WHERE id = OLD.worker_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_employee_completed_count ON public.jobs;
CREATE TRIGGER trg_update_employee_completed_count
    AFTER UPDATE OR INSERT ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_completed_count();

-- -----------------------------------------------------------------------------
-- 3. Data Backfill (Synchronize counts)
-- -----------------------------------------------------------------------------
UPDATE public.profiles p
SET total_jobs = (
    SELECT COUNT(*) 
    FROM public.jobs 
    WHERE worker_id = p.id AND status = 'COMPLETED'
)
WHERE role = 'employee';

-- Ensure all existing reviews are counted
UPDATE public.profiles p
SET reviews_given = (
    SELECT COUNT(*) 
    FROM public.reviews 
    WHERE reviewer_id = p.id
)
WHERE role = 'customer';
