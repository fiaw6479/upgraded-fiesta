/*
  # Fix Subscription Billing Period Calculations

  1. Database Functions
    - Create function to calculate proper billing periods based on plan type
    - Update subscription webhook handler to use accurate period calculations
    - Fix period end calculations for annual and semiannual plans

  2. Webhook Handler Updates
    - Ensure annual plans get exactly 1 year periods
    - Ensure semiannual plans get exactly 6 months periods
    - Fix period start and end date calculations

  3. Subscription Management
    - Update existing subscriptions with correct periods if needed
    - Add helper functions for period calculations
*/

-- Create function to calculate subscription period end date
CREATE OR REPLACE FUNCTION calculate_subscription_period_end(
  plan_type subscription_plan_type,
  period_start timestamptz DEFAULT now() 
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  end_date timestamptz;
BEGIN
  CASE plan_type
    WHEN 'trial' THEN
      end_date := period_start + interval '30 days';
    WHEN 'monthly' THEN
      end_date := period_start + interval '30 days';
    WHEN 'semiannual' THEN
      end_date := period_start + interval '6 months';
    WHEN 'annual' THEN
      end_date := period_start + interval '1 year';
    ELSE
      end_date := period_start + interval '30 days';
  END CASE;
  
  RETURN end_date;
END;
$$;

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
  calculated_start timestamptz;
  calculated_end timestamptz;
  existing_subscription_id uuid;
BEGIN
  -- Use provided dates or calculate them
  calculated_start := COALESCE(p_period_start, now());
  
  IF p_period_end IS NULL THEN
    calculated_end := calculate_subscription_period_end(p_plan_type, calculated_start);
  ELSE
    calculated_end := p_period_end;
  END IF;

  -- Check if user already has a subscription
  SELECT id INTO existing_subscription_id
  FROM subscriptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF existing_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE subscriptions
    SET 
      plan_type = p_plan_type,
      status = p_status,
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      current_period_start = calculated_start,
      current_period_end = calculated_end,
      updated_at = now()
    WHERE id = existing_subscription_id;
    
    RAISE NOTICE 'Updated subscription % for user %', existing_subscription_id, p_user_id;
  ELSE
    -- Create new subscription
    INSERT INTO subscriptions (
      user_id,
      plan_type,
      status,
      stripe_subscription_id,
      stripe_customer_id,
      current_period_start,
      current_period_end
    ) VALUES (
      p_user_id,
      p_plan_type,
      p_status,
      p_stripe_subscription_id,
      p_stripe_customer_id,
      calculated_start,
      calculated_end
    );
    
    RAISE NOTICE 'Created new subscription for user %', p_user_id;
  END IF;
END;
$$;

-- Function to get subscription with proper period calculations
CREATE OR REPLACE FUNCTION get_subscription_with_periods(p_user_id uuid)
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
  days_remaining integer,
  is_expired boolean,
  is_cancelled boolean,
  billing_period_text text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.plan_type,
    s.status,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    s.current_period_start,
    s.current_period_end,
    s.created_at,
    s.updated_at,
    GREATEST(0, EXTRACT(days FROM (s.current_period_end - now()))::integer) as days_remaining,
    (s.current_period_end <= now()) as is_expired,
    (s.status = 'cancelled') as is_cancelled,
    CASE s.plan_type
      WHEN 'annual' THEN '1 year'
      WHEN 'semiannual' THEN '6 months'
      WHEN 'monthly' THEN '1 month'
      WHEN 'trial' THEN 'trial period'
      ELSE 'unknown'
    END as billing_period_text
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;