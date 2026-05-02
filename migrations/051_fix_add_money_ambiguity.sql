-- Migration 051: Fix add_money function ambiguity
--
-- Problem: Migration 048 added add_money(uuid, numeric) and 
-- Migration 050 added add_money(uuid, numeric, text, text) with default values.
-- This caused PostgreSQL to fail when called with 2 arguments because it couldn't
-- decide which function was the better candidate.
--
-- Fix: Drop the old 2-parameter version. The 4-parameter version from 
-- migration 050 handles 2, 3, or 4 arguments thanks to its DEFAULT values.

DROP FUNCTION IF EXISTS public.add_money(user_id uuid, amount numeric);
