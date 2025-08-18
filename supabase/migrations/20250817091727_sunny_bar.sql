/*
  # Fix Billing Period Calculations

  This migration fixes the billing period calculations to use proper calendar intervals
  instead of fixed day counts, ensuring accurate billing periods for all plan types.
*/

-- Drop existing functions to avoid signature conflicts
DROP FUNCTION IF EXISTS calculate_subscription_period_end(text, timestamptz);
DROP FUNCTION IF EXISTS get_subscription_with_periods(uuid);

-- Create improved subscription period calculation function
CREATE OR REPLACE FUNCTION calculate_subscription_period_end(
  plan_type text,
  period_start timestamptz
) RETURNS timestamptz AS $$
BEGIN
  CASE plan_type
    WHEN 'trial' THEN
      RETURN period_start + interval '30 days';
    WHEN 'monthly' THEN
      RETURN period_start + interval '1 month';
    WHEN 'semiannual' THEN
      RETURN period_start + interval '6 months';
    WHEN 'annual' THEN
      RETURN period_start + interval '1 year';
    ELSE
      RETURN period_start + interval '30 days';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get subscription with formatted billing periods
CREATE OR REPLACE FUNCTION get_subscription_with_periods(user_id_param uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  plan_type subscription_plan_type,
  status subscription_status,
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  billing_period_text text,
  plan_duration_text text,
  days_remaining integer,
  is_expired boolean,
  is_cancelled boolean
) AS $$
DECLARE
  sub_record subscriptions%ROWTYPE;
  duration_text text;
BEGIN
  -- Get most recent subscription
  SELECT * INTO sub_record
  FROM subscriptions s
  WHERE s.user_id = user_id_param
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  CASE sub_record.plan_type
    WHEN 'trial' THEN duration_text := '30 days';
    WHEN 'monthly' THEN duration_text := '1 month';
    WHEN 'semiannual' THEN duration_text := '6 months';
    WHEN 'annual' THEN duration_text := '1 year';
    ELSE duration_text := 'unknown';
  END CASE;

  RETURN QUERY SELECT
    sub_record.id,
    sub_record.user_id,
    sub_record.plan_type,
    sub_record.status,
    sub_record.stripe_subscription_id,
    sub_record.stripe_customer_id,
    sub_record.current_period_start,
    sub_record.current_period_end,
    sub_record.created_at,
    sub_record.updated_at,
    TO_CHAR(sub_record.current_period_start, 'MM/DD/YYYY') || ' – ' ||
    TO_CHAR(sub_record.current_period_end, 'MM/DD/YYYY') || ' (' || duration_text || ')' as billing_period_text,
    duration_text as plan_duration_text,
    EXTRACT(DAY FROM sub_record.current_period_end - NOW())::integer as days_remaining,
    (sub_record.current_period_end <= NOW()) as is_expired,
    (sub_record.status = 'cancelled') as is_cancelled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing subscriptions with correct period end dates
UPDATE subscriptions
SET 
  current_period_end = calculate_subscription_period_end(plan_type::text, current_period_start),
  updated_at = NOW()
WHERE status IN ('active', 'cancelled')
  AND current_period_end IS NOT NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created 
ON subscriptions(user_id, created_at DESC);

-- Permissions
GRANT EXECUTE ON FUNCTION calculate_subscription_period_end(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_with_periods(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_with_periods(uuid) TO service_role;
