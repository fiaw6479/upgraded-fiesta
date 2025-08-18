/*
  # Fix Revenue Calculation for Super Admin

  1. Functions
    - Update get_subscription_statistics to calculate total revenue properly
    - Add function to get actual revenue generated from all subscriptions

  2. Security
    - Functions use SECURITY DEFINER for proper access
*/

-- Function to calculate total revenue generated from all subscriptions
CREATE OR REPLACE FUNCTION get_total_subscription_revenue()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_revenue NUMERIC := 0;
  sub_record RECORD;
BEGIN
  -- Calculate total revenue from all subscriptions (active, expired, cancelled)
  FOR sub_record IN 
    SELECT plan_type, status, current_period_start, current_period_end
    FROM subscriptions
    WHERE plan_type != 'trial'
  LOOP
    CASE sub_record.plan_type
      WHEN 'monthly' THEN
        total_revenue := total_revenue + 2.99;
      WHEN 'semiannual' THEN
        total_revenue := total_revenue + 9.99;
      WHEN 'annual' THEN
        total_revenue := total_revenue + 19.99;
    END CASE;
  END LOOP;
  
  RETURN total_revenue;
END;
$$;

-- Update the subscription statistics function to use total revenue
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
  -- Get subscription counts
  SELECT COUNT(*) INTO total_count FROM subscriptions;
  SELECT COUNT(*) INTO active_count FROM subscriptions WHERE status = 'active';
  SELECT COUNT(*) INTO trial_count FROM subscriptions WHERE plan_type = 'trial';
  SELECT COUNT(*) INTO paid_count FROM subscriptions WHERE plan_type != 'trial' AND status = 'active';
  SELECT COUNT(*) INTO cancelled_count FROM subscriptions WHERE status = 'cancelled';
  
  -- Get total revenue generated
  SELECT get_total_subscription_revenue() INTO total_revenue;
  
  -- Calculate churn rate
  churn_rate := CASE WHEN total_count > 0 THEN (cancelled_count::NUMERIC / total_count::NUMERIC) * 100 ELSE 0 END;
  
  result := json_build_object(
    'total', total_count,
    'active', active_count,
    'trial', trial_count,
    'paid', paid_count,
    'totalRevenue', total_revenue,
    'churnRate', churn_rate
  );
  
  RETURN result;
END;
$$;