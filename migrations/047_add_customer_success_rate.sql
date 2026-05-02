-- 047_add_customer_success_rate.sql
-- 1. Add success_rate column to profiles
-- 2. Create function to calculate success rate for customers
-- 3. Add trigger to jobs table to update success rate on status changes

-- 1. Add the column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS success_rate NUMERIC(5,2) DEFAULT 100.00;

-- 2. Function to calculate success rate
-- Formula: (Completed Jobs / (Total Jobs - Currently Open Jobs)) * 100
-- We exclude 'OPEN' jobs because they haven't had a chance to succeed or fail yet.
CREATE OR REPLACE FUNCTION calculate_customer_success_rate(p_customer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_relevant INTEGER;
    v_completed INTEGER;
BEGIN
    -- Count jobs that are finished (COMPLETED or CANCELLED)
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'COMPLETED')
    INTO v_total_relevant, v_completed
    FROM public.jobs
    WHERE customer_id = p_customer_id
      AND status IN ('COMPLETED', 'CANCELLED');

    IF v_total_relevant = 0 THEN
        RETURN 100.00; -- Default for new users
    END IF;

    RETURN ROUND((v_completed::NUMERIC / v_total_relevant::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger function to sync the rate
CREATE OR REPLACE FUNCTION sync_customer_success_rate()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if the status changed to a final state (COMPLETED or CANCELLED)
    -- or if a job was deleted
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.profiles 
        SET success_rate = calculate_customer_success_rate(OLD.customer_id)
        WHERE id = OLD.customer_id;
    ELSE
        UPDATE public.profiles 
        SET success_rate = calculate_customer_success_rate(NEW.customer_id)
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger to jobs table
DROP TRIGGER IF EXISTS trg_sync_customer_success_rate ON public.jobs;
CREATE TRIGGER trg_sync_customer_success_rate
    AFTER UPDATE OF status OR INSERT OR DELETE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_success_rate();

-- 5. Backfill existing users
UPDATE public.profiles p
SET success_rate = calculate_customer_success_rate(p.id)
WHERE role = 'customer';
