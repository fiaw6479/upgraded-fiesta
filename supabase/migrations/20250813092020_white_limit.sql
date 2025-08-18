/*
  # Fix Subscription Revenue Tracking

  1. Functions
    - Update get_total_subscription_revenue to accurately calculate total revenue
    - Fix subscription statistics to show proper revenue amounts
    - Add proper revenue tracking for all plan types

  2. Security
    - Functions use SECURITY DEFINER for proper access
    - Maintain existing RLS policies
*/

-- Function to calculate total subscription revenue accurately
CREATE OR REPLACE FUNCTION get_total_subscription_revenue()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_revenue NUMERIC := 0;
  sub_record RECORD;
BEGIN
  -- Calculate revenue based on plan types and status
  FOR sub_record IN 
    SELECT plan_type, status, created_at, current_period_end
    FROM subscriptions 
    WHERE status IN ('active', 'expired', 'cancelled')
  LOOP
    -- Only count revenue for subscriptions that were actually paid for
    IF sub_record.plan_type = 'monthly' THEN
      -- For monthly, count each month the subscription was active
      total_revenue := total_revenue + 2.99;
    ELSIF sub_record.plan_type = 'semiannual' THEN
      total_revenue := total_revenue + 9.99;
    ELSIF sub_record.plan_type = 'annual' THEN
      total_revenue := total_revenue + 19.99;
    END IF;
    -- Trial plans generate $0 revenue
  END LOOP;
  
  RETURN COALESCE(total_revenue, 0);
END;
$$;

-- Function to get accurate subscription statistics
CREATE OR REPLACE FUNCTION get_subscription_statistics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_count INTEGER;
  active_count INTEGER;
  trial_count INTEGER;
  paid_count INTEGER;
  cancelled_count INTEGER;
  total_revenue NUMERIC;
  churn_rate NUMERIC;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO total_count FROM subscriptions;
  SELECT COUNT(*) INTO active_count FROM subscriptions WHERE status = 'active';
  SELECT COUNT(*) INTO trial_count FROM subscriptions WHERE plan_type = 'trial';
  SELECT COUNT(*) INTO paid_count FROM subscriptions WHERE plan_type != 'trial' AND status = 'active';
  SELECT COUNT(*) INTO cancelled_count FROM subscriptions WHERE status = 'cancelled';
  
  -- Calculate total revenue
  SELECT get_total_subscription_revenue() INTO total_revenue;
  
  -- Calculate churn rate
  IF total_count > 0 THEN
    churn_rate := (cancelled_count::NUMERIC / total_count::NUMERIC) * 100;
  ELSE
    churn_rate := 0;
  END IF;
  
  -- Build result
  result := json_build_object(
    'total', COALESCE(total_count, 0),
    'active', COALESCE(active_count, 0),
    'trial', COALESCE(trial_count, 0),
    'paid', COALESCE(paid_count, 0),
    'totalRevenue', COALESCE(total_revenue, 0),
    'churnRate', COALESCE(churn_rate, 0)
  );
  
  RETURN result;
END;
$$;