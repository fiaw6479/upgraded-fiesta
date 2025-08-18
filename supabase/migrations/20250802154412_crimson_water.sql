/*
  # Create subscriptions table for Voya billing system

  1. New Tables
    - `subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `plan_type` (enum: trial, monthly, semiannual, annual)
      - `status` (enum: active, expired, cancelled, past_due)
      - `stripe_subscription_id` (text, nullable)
      - `stripe_customer_id` (text, nullable)
      - `current_period_start` (timestamptz)
      - `current_period_end` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `subscriptions` table
    - Add policies for users to read their own subscription data
    - Add policies for super admins to manage all subscriptions

  3. Functions
    - Add trigger to update `updated_at` timestamp
    - Add function to check subscription access
*/

-- Create enum types for subscription plans and statuses
CREATE TYPE subscription_plan_type AS ENUM ('trial', 'monthly', 'semiannual', 'annual');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'past_due');

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type subscription_plan_type NOT NULL DEFAULT 'trial',
  status subscription_status NOT NULL DEFAULT 'active',
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type ON subscriptions(plan_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own subscription data"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscription data"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscription data"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can manage all subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_super_admin = true
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION check_subscription_access(p_user_id uuid)
RETURNS TABLE (
  has_access boolean,
  plan_type subscription_plan_type,
  status subscription_status,
  days_remaining integer,
  features jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record subscriptions%ROWTYPE;
  days_left integer;
  plan_features jsonb;
BEGIN
  -- Get the most recent subscription for the user
  SELECT * INTO sub_record
  FROM subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no subscription found, return trial access
  IF sub_record.id IS NULL THEN
    RETURN QUERY SELECT 
      false,
      'trial'::subscription_plan_type,
      'expired'::subscription_status,
      0,
      '{"maxCustomers": 100, "maxBranches": 1, "advancedAnalytics": false, "prioritySupport": false, "customBranding": false, "apiAccess": false}'::jsonb;
    RETURN;
  END IF;

  -- Calculate days remaining
  days_left := GREATEST(0, EXTRACT(DAY FROM (sub_record.current_period_end - now())));

  -- Determine features based on plan type
  CASE sub_record.plan_type
    WHEN 'trial' THEN
      plan_features := '{"maxCustomers": 100, "maxBranches": 1, "advancedAnalytics": false, "prioritySupport": false, "customBranding": false, "apiAccess": false}'::jsonb;
    WHEN 'monthly' THEN
      plan_features := '{"maxCustomers": -1, "maxBranches": -1, "advancedAnalytics": true, "prioritySupport": true, "customBranding": false, "apiAccess": false}'::jsonb;
    WHEN 'semiannual' THEN
      plan_features := '{"maxCustomers": -1, "maxBranches": -1, "advancedAnalytics": true, "prioritySupport": true, "customBranding": true, "apiAccess": true}'::jsonb;
    WHEN 'annual' THEN
      plan_features := '{"maxCustomers": -1, "maxBranches": -1, "advancedAnalytics": true, "prioritySupport": true, "customBranding": true, "apiAccess": true}'::jsonb;
    ELSE
      plan_features := '{"maxCustomers": 100, "maxBranches": 1, "advancedAnalytics": false, "prioritySupport": false, "customBranding": false, "apiAccess": false}'::jsonb;
  END CASE;

  -- Return subscription data
  RETURN QUERY SELECT 
    (sub_record.status = 'active' AND sub_record.current_period_end > now()),
    sub_record.plan_type,
    sub_record.status,
    days_left,
    plan_features;
END;
$$;