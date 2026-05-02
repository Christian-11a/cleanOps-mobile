-- 040_review_notification_trigger.sql
-- Sends a new_review notification to the reviewee when a review is inserted.
-- Done via DB trigger because RLS on notifications only allows users to insert
-- for themselves — a client cannot insert a notification for another user.

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

DROP TRIGGER IF EXISTS on_review_inserted ON public.reviews;
CREATE TRIGGER on_review_inserted
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_review();
