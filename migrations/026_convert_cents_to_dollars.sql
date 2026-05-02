-- Migration 026: Convert Old Data from Cents to Dollars
-- This script fixes the issue where old jobs and balances (stored as cents like 7000)
-- show up as $7,000 because the app no longer divides by 100.

-- 1. Convert Job Prices
-- We divide by 100 to turn 7000 cents into 70.00 dollars.
-- We add a safety check (price_amount >= 100) to ensure we don't accidentally divide new jobs 
-- that might have already been created with the correct dollar amount (e.g., 60).
UPDATE public.jobs 
SET price_amount = price_amount / 100 
WHERE price_amount >= 100;

-- 2. Convert Wallet Balances
-- Same logic for user wallets. 
UPDATE public.profiles 
SET money_balance = money_balance / 100 
WHERE money_balance >= 100;
