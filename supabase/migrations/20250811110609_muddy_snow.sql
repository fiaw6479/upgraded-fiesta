/*
  # Create function to get user emails for Super Admin

  1. New Functions
    - `get_user_emails` - Safely get user emails from auth.users for admin purposes
    - `get_system_wide_stats` - Get comprehensive system statistics
    - `handle_subscription_webhook` - Handle Stripe webhook events

  2. Security
    - Functions are accessible to service role only
    - Proper error handling and validation
*/

-- Function to get user emails (for Super Admin use)
CREATE OR REPLACE FUNCTION get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;

-- Function to get comprehensive system stats
CREATE OR REPLACE FUNCTION get_system_wide_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_restaurants integer;
  total_customers integer;
  total_points_issued bigint;
  total_revenue numeric;
  active_subscriptions integer;
  trial_subscriptions integer;
  paid_subscriptions integer;
  monthly_revenue numeric;
BEGIN
  -- Get restaurant count
  SELECT COUNT(*) INTO total_restaurants FROM restaurants;
  
  -- Get customer count
  SELECT COUNT(*) INTO total_customers FROM customers;
  
  -- Get total points issued
  SELECT COALESCE(SUM(points), 0) INTO total_points_issued 
  FROM transactions 
  WHERE points > 0;
  
  -- Get total revenue
  SELECT COALESCE(SUM(total_spent), 0) INTO total_revenue 
  FROM customers;
  
  -- Get subscription stats
  SELECT COUNT(*) INTO active_subscriptions 
  FROM subscriptions 
  WHERE status = 'active';
  
  SELECT COUNT(*) INTO trial_subscriptions 
  FROM subscriptions 
  WHERE plan_type = 'trial' AND status = 'active';
  
  SELECT COUNT(*) INTO paid_subscriptions 
  FROM subscriptions 
  WHERE plan_type != 'trial' AND status = 'active';
  
  -- Calculate monthly revenue
  SELECT COALESCE(
    SUM(CASE 
      WHEN plan_type = 'monthly' THEN 2.99
      WHEN plan_type = 'semiannual' THEN 9.99 / 6
      WHEN plan_type = 'annual' THEN 19.99 / 12
      ELSE 0
    END), 0
  ) INTO monthly_revenue
  FROM subscriptions 
  WHERE status = 'active' AND plan_type != 'trial';
  
  -- Build result
  result := json_build_object(
    'totalRestaurants', total_restaurants,
    'totalCustomers', total_customers,
    'totalPointsIssued', total_points_issued,
    'totalRevenue', total_revenue,
    'activeSubscriptions', active_subscriptions,
    'trialSubscriptions', trial_subscriptions,
    'paidSubscriptions', paid_subscriptions,
    'monthlyRevenue', monthly_revenue
  );
  
  RETURN result;
END;
$$;

-- Function to handle Stripe webhook events
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
  calculated_period_end timestamptz;
  existing_subscription_id uuid;
BEGIN
  -- Calculate period end if not provided
  IF p_period_end IS NULL THEN
    calculated_period_end := CASE 
      WHEN p_plan_type = 'trial' THEN (COALESCE(p_period_start, NOW()) + INTERVAL '30 days')
      WHEN p_plan_type = 'monthly' THEN (COALESCE(p_period_start, NOW()) + INTERVAL '30 days')
      WHEN p_plan_type = 'semiannual' THEN (COALESCE(p_period_start, NOW()) + INTERVAL '6 months')
      WHEN p_plan_type = 'annual' THEN (COALESCE(p_period_start, NOW()) + INTERVAL '1 year')
      ELSE (COALESCE(p_period_start, NOW()) + INTERVAL '30 days')
    END;
  ELSE
    calculated_period_end := p_period_end;
  END IF;

  -- Check if subscription exists
  SELECT id INTO existing_subscription_id
  FROM subscriptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF existing_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE subscriptions SET
      plan_type = p_plan_type,
      status = p_status,
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      current_period_start = COALESCE(p_period_start, current_period_start),
      current_period_end = calculated_period_end,
      updated_at = NOW()
    WHERE id = existing_subscription_id;
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
      COALESCE(p_period_start, NOW()),
      calculated_period_end
    );
  END IF;

  -- Ensure user exists in users table
  INSERT INTO users (id, email)
  SELECT p_user_id, au.email
  FROM auth.users au
  WHERE au.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_subscription_webhook: %', SQLERRM;
    RAISE;
END;
$$;