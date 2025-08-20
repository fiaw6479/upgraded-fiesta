/*
  # Fix Billing Period Calculation System

  1. Database Functions
    - Fix update_billing_period_text function to properly calculate periods
    - Add dynamic billing period calculation based on plan type
    - Ensure accurate period text generation

  2. Improvements
    - Handle all plan types correctly (trial, monthly, semiannual, annual)
    - Generate human-readable billing period text
    - Mark billing periods as accurate when calculated correctly
    - Add proper error handling for edge cases

  3. Triggers
    - Ensure trigger fires on both INSERT and UPDATE
    - Recalculate billing periods when subscription data changes

  4. Key Fix
    - Drop trigger BEFORE dropping function to resolve dependency error
    - Proper order of operations to prevent 2BP01 error
*/

-- CRITICAL FIX: Drop the trigger FIRST before dropping the function
-- This resolves the dependency error (2BP01)
DROP TRIGGER IF EXISTS trigger_update_billing_period_text ON subscriptions;
 
-- Now we can safely drop the function
DROP FUNCTION IF EXISTS update_billing_period_text();

-- Recreate the function with improved logic
CREATE OR REPLACE FUNCTION update_billing_period_text()
RETURNS TRIGGER AS $$
DECLARE
  period_text TEXT;
  duration_text TEXT;
  start_date DATE;
  end_date DATE;
  actual_duration_days INTEGER;
  expected_duration_days INTEGER;
  is_accurate BOOLEAN := true;
BEGIN
  -- Extract dates
  start_date := NEW.current_period_start::DATE;
  end_date := NEW.current_period_end::DATE;
  
  -- Calculate actual duration
  actual_duration_days := end_date - start_date;
  
  -- Determine expected duration and text based on plan type
  CASE NEW.plan_type
    WHEN 'trial' THEN
      expected_duration_days := 30;
      duration_text := '30 days';
    WHEN 'monthly' THEN
      expected_duration_days := 30; -- Approximate, will vary by month
      duration_text := '1 month';
    WHEN 'semiannual' THEN
      expected_duration_days := 183; -- Approximate 6 months
      duration_text := '6 months';
    WHEN 'annual' THEN
      expected_duration_days := 365; -- Approximate 1 year
      duration_text := '1 year';
    ELSE
      expected_duration_days := actual_duration_days;
      duration_text := actual_duration_days || ' days';
  END CASE;
  
  -- Check if billing period is accurate (within reasonable tolerance)
  IF NEW.plan_type = 'monthly' THEN
    -- For monthly, check if it's between 28-31 days
    is_accurate := actual_duration_days BETWEEN 28 AND 31;
  ELSIF NEW.plan_type = 'semiannual' THEN
    -- For semiannual, check if it's between 180-186 days (6 months ±3 days)
    is_accurate := actual_duration_days BETWEEN 180 AND 186;
  ELSIF NEW.plan_type = 'annual' THEN
    -- For annual, check if it's between 360-370 days (1 year ±5 days)
    is_accurate := actual_duration_days BETWEEN 360 AND 370;
  ELSIF NEW.plan_type = 'trial' THEN
    -- For trial, check if it's between 28-32 days
    is_accurate := actual_duration_days BETWEEN 28 AND 32;
  ELSE
    is_accurate := true; -- Unknown plan types are considered accurate
  END IF;
  
  -- Generate human-readable billing period text
  period_text := TO_CHAR(start_date, 'Mon DD, YYYY') || ' – ' || TO_CHAR(end_date, 'Mon DD, YYYY') || ' (' || duration_text || ')';
  
  -- Update the record
  NEW.billing_period_text := period_text;
  NEW.billing_period_accurate := is_accurate;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_billing_period_text
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_period_text();

-- Update existing subscriptions to recalculate billing periods
UPDATE subscriptions 
SET updated_at = NOW()
WHERE billing_period_text IS NULL 
   OR billing_period_accurate IS NULL 
   OR billing_period_accurate = false;

-- Add helpful function to manually recalculate billing periods
CREATE OR REPLACE FUNCTION recalculate_all_billing_periods()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE subscriptions 
  SET updated_at = NOW()
  WHERE true;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql; 