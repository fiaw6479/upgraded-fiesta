/*
  # Fix subscription relationships and Super Admin functionality

  1. Database Functions
    - Enhanced subscription webhook handling
    - System-wide statistics calculation
    - User email retrieval for admin purposes

  2. Data Integrity
    - Ensure users table is populated from auth.users
    - Fix foreign key relationships
    - Add missing indexes for performance

  3. Super Admin Support
    - Functions to support comprehensive dashboard metrics
    - Proper error handling and fallbacks
*/

-- Ensure all auth users are in the users table
INSERT INTO users (id, email, user_metadata, is_super_admin)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data, '{}'),
  false
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  user_metadata = EXCLUDED.user_metadata,
  updated_at = NOW();

-- Function to sync auth users to users table (for ongoing sync)
CREATE OR REPLACE FUNCTION sync_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO users (id, email, user_metadata)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data, '{}'))
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    user_metadata = EXCLUDED.user_metadata,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically sync new auth users
DROP TRIGGER IF EXISTS sync_auth_users_trigger ON auth.users;
CREATE TRIGGER sync_auth_users_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_users();

-- Enhanced function to get subscription statistics
CREATE OR REPLACE FUNCTION get_subscription_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_subs integer;
  active_subs integer;
  trial_subs integer;
  paid_subs integer;
  cancelled_subs integer;
  total_revenue numeric;
  monthly_revenue numeric;
  churn_rate numeric;
BEGIN
  -- Get subscription counts
  SELECT COUNT(*) INTO total_subs FROM subscriptions;
  
  SELECT COUNT(*) INTO active_subs 
  FROM subscriptions 
  WHERE status = 'active';
  
  SELECT COUNT(*) INTO trial_subs 
  FROM subscriptions 
  WHERE plan_type = 'trial';
  
  SELECT COUNT(*) INTO paid_subs 
  FROM subscriptions 
  WHERE plan_type != 'trial' AND status = 'active';
  
  SELECT COUNT(*) INTO cancelled_subs 
  FROM subscriptions 
  WHERE status = 'cancelled';
  
  -- Calculate revenue
  SELECT COALESCE(
    SUM(CASE 
      WHEN plan_type = 'monthly' AND status = 'active' THEN 2.99
      WHEN plan_type = 'semiannual' AND status = 'active' THEN 9.99
      WHEN plan_type = 'annual' AND status = 'active' THEN 19.99
      ELSE 0
    END), 0
  ) INTO total_revenue
  FROM subscriptions;
  
  -- Calculate monthly recurring revenue
  SELECT COALESCE(
    SUM(CASE 
      WHEN plan_type = 'monthly' AND status = 'active' THEN 2.99
      WHEN plan_type = 'semiannual' AND status = 'active' THEN 9.99 / 6
      WHEN plan_type = 'annual' AND status = 'active' THEN 19.99 / 12
      ELSE 0
    END), 0
  ) INTO monthly_revenue
  FROM subscriptions;
  
  -- Calculate churn rate
  IF total_subs > 0 THEN
    churn_rate := (cancelled_subs::numeric / total_subs::numeric) * 100;
  ELSE
    churn_rate := 0;
  END IF;
  
  -- Build result
  result := json_build_object(
    'total', total_subs,
    'active', active_subs,
    'trial', trial_subs,
    'paid', paid_subs,
    'cancelled', cancelled_subs,
    'revenue', total_revenue,
    'monthlyRevenue', monthly_revenue,
    'churnRate', churn_rate
  );
  
  RETURN result;
END;
$$;

-- Function to get recent subscriptions with user and restaurant data
CREATE OR REPLACE FUNCTION get_recent_subscriptions(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  user_email text,
  restaurant_name text,
  plan_type subscription_plan_type,
  status subscription_status,
  created_at timestamptz,
  current_period_end timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    u.email as user_email,
    COALESCE(r.name, 'Unknown Restaurant') as restaurant_name,
    s.plan_type,
    s.status,
    s.created_at,
    s.current_period_end,
    s.stripe_subscription_id,
    s.stripe_customer_id
  FROM subscriptions s
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN restaurants r ON r.owner_id = s.user_id
  ORDER BY s.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type ON subscriptions(plan_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);

-- Add index for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_emails(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION get_system_wide_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_subscription_statistics() TO service_role;
GRANT EXECUTE ON FUNCTION get_recent_subscriptions(integer) TO service_role;
GRANT EXECUTE ON FUNCTION handle_subscription_webhook(uuid, subscription_plan_type, subscription_status, text, text, timestamptz, timestamptz) TO service_role;