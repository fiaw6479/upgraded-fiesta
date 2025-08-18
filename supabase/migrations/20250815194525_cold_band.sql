/*
  # Fix Subscription Billing Period Calculations

  1. Database Function Updates
    - Fix subscription webhook handler to calculate proper periods
    - Ensure annual plans get 1 year periods, not 1 month
    - Update period calculation logic

  2. Subscription Management
    - Add proper period calculation for all plan types
    - Fix billing period display logic
    - Handle cancelled vs expired states properly
*/

-- Create or replace the subscription webhook handler with proper period calculations
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
  v_existing_subscription_id uuid;
BEGIN
  -- Set period start to now if not provided
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

  -- Check if user already has a subscription
  SELECT id INTO v_existing_subscription_id
  FROM subscriptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_existing_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE subscriptions
    SET 
      plan_type = p_plan_type,
      status = p_status,
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      updated_at = now()
    WHERE id = v_existing_subscription_id;
    
    RAISE LOG 'Updated existing subscription % for user %', v_existing_subscription_id, p_user_id;
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
      v_period_start,
      v_period_end
    );
    
    RAISE LOG 'Created new subscription for user %', p_user_id;
  END IF;
END;
$$;

-- Create function to get subscription with proper access logic
CREATE OR REPLACE FUNCTION get_subscription_access(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_has_access boolean := false;
  v_days_remaining integer := 0;
  v_is_expired boolean := false;
  v_is_cancelled boolean := false;
  v_features jsonb;
BEGIN
  -- Get the user's subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no subscription found, return trial access
  IF v_subscription.id IS NULL THEN
    RETURN jsonb_build_object(
      'hasAccess', true,
      'subscription', null,
      'features', jsonb_build_object(
        'maxCustomers', 100,
        'maxBranches', 1,
        'advancedAnalytics', false,
        'prioritySupport', false,
        'customBranding', false,
        'apiAccess', false
      ),
      'daysRemaining', 30,
      'isExpired', false,
      'isCancelled', false
    );
  END IF;

  -- Calculate access and status
  v_is_expired := v_subscription.current_period_end <= now();
  v_is_cancelled := v_subscription.status = 'cancelled';
  v_days_remaining := GREATEST(0, EXTRACT(days FROM v_subscription.current_period_end - now())::integer);
  
  -- Allow access if subscription is active OR cancelled but not yet expired
  v_has_access := (v_subscription.status = 'active' OR (v_is_cancelled AND NOT v_is_expired)) 
                  AND v_subscription.current_period_end > now();

  -- Set features based on plan type
  CASE v_subscription.plan_type
    WHEN 'trial' THEN
      v_features := jsonb_build_object(
        'maxCustomers', 100,
        'maxBranches', 1,
        'advancedAnalytics', false,
        'prioritySupport', false,
        'customBranding', false,
        'apiAccess', false
      );
    WHEN 'monthly', 'semiannual', 'annual' THEN
      v_features := jsonb_build_object(
        'maxCustomers', -1,
        'maxBranches', -1,
        'advancedAnalytics', true,
        'prioritySupport', true,
        'customBranding', v_subscription.plan_type != 'monthly',
        'apiAccess', v_subscription.plan_type != 'monthly'
      );
    ELSE
      v_features := jsonb_build_object(
        'maxCustomers', 100,
        'maxBranches', 1,
        'advancedAnalytics', false,
        'prioritySupport', false,
        'customBranding', false,
        'apiAccess', false
      );
  END CASE;

  RETURN jsonb_build_object(
    'hasAccess', v_has_access,
    'subscription', row_to_json(v_subscription),
    'features', v_features,
    'daysRemaining', v_days_remaining,
    'isExpired', v_is_expired,
    'isCancelled', v_is_cancelled
  );
END;
$$;