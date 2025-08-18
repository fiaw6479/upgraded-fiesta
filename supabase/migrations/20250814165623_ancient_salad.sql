/*
  # Fix Subscription Period Calculations

  1. Database Function Updates
    - Update subscription webhook handler to calculate proper periods
    - Fix period calculations for different plan types
    - Ensure accurate billing period display

  2. Period Calculation Logic
    - Monthly: 30 days from start
    - Semiannual: Exactly 6 months from start
    - Annual: Exactly 1 year from start
    - Trial: 30 days from start
*/

-- Update the subscription webhook handler function
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_user_id uuid,
  p_plan_type subscription_plan_type,
  p_status subscription_status,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  -- Use provided period start or current time
  v_period_start := COALESCE(p_period_start, now());
  
  -- Calculate period end based on plan type if not provided
  IF p_period_end IS NULL THEN
    CASE p_plan_type
      WHEN 'trial' THEN
        v_period_end := v_period_start + interval '30 days';
      WHEN 'monthly' THEN
        v_period_end := v_period_start + interval '30 days';
      WHEN 'semiannual' THEN
        v_period_end := v_period_start + interval '6 months';
      WHEN 'annual' THEN
        v_period_end := v_period_start + interval '1 year';
      ELSE
        v_period_end := v_period_start + interval '30 days';
    END CASE;
  ELSE
    v_period_end := p_period_end;
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
    v_period_start,
    v_period_end,
    now(),
    now()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status,
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();

  -- Log the webhook processing
  RAISE NOTICE 'Subscription webhook processed for user % with plan % and status %', p_user_id, p_plan_type, p_status;
END;
$$;