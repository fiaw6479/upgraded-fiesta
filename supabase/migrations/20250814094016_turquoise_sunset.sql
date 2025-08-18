/*
  # Fix Billing Period Calculation

  1. Functions
    - Update subscription webhook handler to calculate proper periods
    - Fix period calculation for different plan types
  
  2. Subscription Management
    - Ensure accurate period start/end dates
    - Handle one-time vs recurring payments properly
*/

-- Function to calculate proper subscription period end date
CREATE OR REPLACE FUNCTION calculate_subscription_period_end(
  plan_type subscription_plan_type,
  period_start timestamptz
) RETURNS timestamptz AS $$
BEGIN
  CASE plan_type
    WHEN 'trial' THEN
      RETURN period_start + INTERVAL '30 days';
    WHEN 'monthly' THEN
      RETURN period_start + INTERVAL '1 month';
    WHEN 'semiannual' THEN
      RETURN period_start + INTERVAL '6 months';
    WHEN 'annual' THEN
      RETURN period_start + INTERVAL '1 year';
    ELSE
      RETURN period_start + INTERVAL '30 days';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update the subscription webhook handler to use proper period calculation
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_user_id uuid,
  p_plan_type subscription_plan_type,
  p_status subscription_status,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL
) RETURNS void AS $$
DECLARE
  calculated_period_start timestamptz;
  calculated_period_end timestamptz;
BEGIN
  -- Use provided dates or calculate them
  calculated_period_start := COALESCE(p_period_start, now());
  
  IF p_period_end IS NULL THEN
    calculated_period_end := calculate_subscription_period_end(p_plan_type, calculated_period_start);
  ELSE
    calculated_period_end := p_period_end;
  END IF;

  -- Insert or update subscription
  INSERT INTO subscriptions (
    user_id,
    plan_type,
    status,
    stripe_subscription_id,
    stripe_customer_id,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_plan_type,
    p_status,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    calculated_period_start,
    calculated_period_end,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status,
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;