-- Migration 020: Add settings and service_radius to profiles
-- This allows syncing user preferences (Push, SMS, etc.) and employee search radius across devices.

-- 1. Add settings JSONB column with defaults matching our settingsStore.ts
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{
  "pushNotifications": true,
  "emailUpdates": true,
  "smsAlerts": false,
  "promos": false,
  "biometrics": false
}'::jsonb;

-- 2. Add service_radius column for employees (default 15km)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS service_radius INTEGER NOT NULL DEFAULT 15;

-- 3. Update existing profiles to ensure they have the default JSON structure
UPDATE public.profiles 
SET settings = '{
  "pushNotifications": true,
  "emailUpdates": true,
  "smsAlerts": false,
  "promos": false,
  "biometrics": false
}'::jsonb
WHERE settings IS NULL;

-- 4. Add index for service_radius to optimize nearby job queries in the future
CREATE INDEX IF NOT EXISTS idx_profiles_service_radius ON public.profiles(service_radius);

COMMENT ON COLUMN public.profiles.settings IS 'Stores user-specific toggles (Push, SMS, Biometrics, etc.)';
COMMENT ON COLUMN public.profiles.service_radius IS 'Search radius in KM for employees to filter their job feed';
