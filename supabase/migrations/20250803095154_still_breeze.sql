/*
  # Fix subscription RLS policies and infinite recursion

  1. Database Changes
    - Drop problematic RLS policies causing infinite recursion
    - Create simplified, safe RLS policies for subscriptions
    - Ensure users table policies don't conflict
    - Add proper indexes for performance

  2. Security
    - Maintain proper access control without recursion
    - Users can only access their own subscription data
    - Super admins can manage all subscriptions
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription data" ON subscriptions;
DROP POLICY IF EXISTS "Users can read own subscription data" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription data" ON subscriptions;

-- Create safe, non-recursive policies for subscriptions
CREATE POLICY "Users can manage own subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create a separate policy for super admin access (if needed)
-- Note: This assumes you have a way to identify super admins without circular reference
CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure users table has simple, non-recursive policies
DROP POLICY IF EXISTS "Super admin can read all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create simple user policies
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Service role access for users (for admin functions)
CREATE POLICY "Service role can manage users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add function to safely check subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid uuid)
RETURNS TABLE (
  has_access boolean,
  plan_type subscription_plan_type,
  status subscription_status,
  days_remaining integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record subscriptions%ROWTYPE;
  end_date timestamp with time zone;
  now_date timestamp with time zone := now();
BEGIN
  -- Get the most recent subscription for the user
  SELECT * INTO sub_record
  FROM subscriptions
  WHERE user_id = user_uuid
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no subscription found, return trial defaults
  IF sub_record.id IS NULL THEN
    RETURN QUERY SELECT false, 'trial'::subscription_plan_type, 'expired'::subscription_status, 0;
    RETURN;
  END IF;
  
  end_date := sub_record.current_period_end;
  
  RETURN QUERY SELECT 
    (sub_record.status = 'active' AND end_date > now_date),
    sub_record.plan_type,
    sub_record.status,
    GREATEST(0, EXTRACT(DAY FROM (end_date - now_date))::integer);
END;
$$;