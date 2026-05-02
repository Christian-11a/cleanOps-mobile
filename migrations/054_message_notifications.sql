-- Migration 054: Notification Trigger for Messages
--
-- Sends a notification to the recipient when a new message is sent.
-- This ensures users/employees get alerts even if they aren't looking at the chat.

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
    v_recipient_id UUID;
    v_sender_name TEXT;
    v_job_customer_id UUID;
    v_job_worker_id UUID;
BEGIN
    -- 1. Get the job's participants to find the recipient
    SELECT customer_id, worker_id INTO v_job_customer_id, v_job_worker_id
    FROM public.jobs
    WHERE id = NEW.job_id;

    -- 2. Recipient is the person who DID NOT send the message
    IF NEW.sender_id = v_job_customer_id THEN
        v_recipient_id := v_job_worker_id;
    ELSE
        v_recipient_id := v_job_customer_id;
    END IF;

    -- 3. If no recipient (e.g. job not claimed yet), exit
    IF v_recipient_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 4. Get sender's name for the alert
    SELECT full_name INTO v_sender_name
    FROM public.profiles
    WHERE id = NEW.sender_id;

    -- 5. Insert notification
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
        v_recipient_id,
        'new_message',
        jsonb_build_object(
            'job_id', NEW.job_id,
            'sender_name', COALESCE(v_sender_name, 'Someone'),
            'message_snippet', LEFT(NEW.content, 50)
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_message ON public.messages;
CREATE TRIGGER trg_notify_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_message();
