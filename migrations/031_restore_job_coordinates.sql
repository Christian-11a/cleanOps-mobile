-- Migration 035: Restore location_lat and location_lng to jobs table
-- This allows for Peer-to-Peer distance calculation without breaking existing address fields.
-- Run this in your Supabase SQL Editor.

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;

-- Optional: If you want to store the User's coordinates in their profile for 'Home Base' distance
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
