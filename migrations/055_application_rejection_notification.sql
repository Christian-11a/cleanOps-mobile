-- Migration 055: Rejection Notification Trigger
--
-- Notifies the employee when their application status is updated to 'REJECTED'.

CREATE OR REPLACE FUNCTION public.notify_on_application_rejection()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if status changed from PENDING to REJECTED
    IF NEW.status = 'REJECTED' AND (OLD.status = 'PENDING' OR OLD.status IS NULL) THEN
        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (
            NEW.employee_id,
            'application_rejected',
            jsonb_build_object(
                'job_id', NEW.job_id,
                'message', 'Your application was declined by the customer.'
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_rejection ON public.job_applications;
CREATE TRIGGER trg_notify_on_rejection
    AFTER UPDATE ON public.job_applications
    FOR EACH ROW
    WHEN (NEW.status = 'REJECTED' AND OLD.status != 'REJECTED')
    EXECUTE FUNCTION notify_on_application_rejection();
