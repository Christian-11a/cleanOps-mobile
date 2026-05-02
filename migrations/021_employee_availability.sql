-- Migration 021: Create employee_availability table
-- Stores weekly schedule and shift times for employees.

CREATE TABLE IF NOT EXISTS public.employee_availability (
  employee_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule JSONB NOT NULL DEFAULT '{
    "Monday": true,
    "Tuesday": true,
    "Wednesday": true,
    "Thursday": true,
    "Friday": true,
    "Saturday": true,
    "Sunday": true
  }'::jsonb,
  shift_start TEXT NOT NULL DEFAULT '08:00 AM',
  shift_end TEXT NOT NULL DEFAULT '05:00 PM',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_employee_availability_updated ON public.employee_availability(updated_at);

-- Trigger for updated_at
CREATE TRIGGER trg_employee_availability_updated_at
  BEFORE UPDATE ON public.employee_availability
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS: Employees can manage their own availability
ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own availability"
  ON public.employee_availability FOR SELECT
  USING (auth.uid() = employee_id);

CREATE POLICY "Employees can insert/update own availability"
  ON public.employee_availability FOR ALL
  USING (auth.uid() = employee_id)
  WITH CHECK (auth.uid() = employee_id);

COMMENT ON TABLE public.employee_availability IS 'Stores employee-specific working hours and weekly schedule';
