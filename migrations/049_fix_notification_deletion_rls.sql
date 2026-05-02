-- 049_fix_notification_deletion_rls.sql
-- Adds missing DELETE policy for notifications table to allow users to clear their history.

-- 1. Notifications Delete Policy
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Optional: Add delete policies for other tables if users need to remove their own data
-- (e.g., job applications if they withdraw)
CREATE POLICY "job_applications_delete_own"
  ON public.job_applications FOR DELETE
  USING (auth.uid() = employee_id);
