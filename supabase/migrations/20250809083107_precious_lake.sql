/*
  # Fix subscription foreign key and webhook processing

  1. Database Changes
    - Add proper foreign key constraint between subscriptions and auth.users
    - Ensure unique constraint on user_id for proper upserts
    - Add indexes for better performance

  2. Webhook Processing
    - Fix subscription updates from Stripe webhooks
    - Handle both subscription and one-time payments properly
*/

-- Add foreign key constraint to subscriptions table
DO $$
BEGIN
  -- Check if foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'subscriptions_user_id_fkey' 
    AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure unique constraint exists for proper webhook upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_subscription' 
    AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE subscriptions 
    ADD CONSTRAINT unique_user_subscription UNIQUE (user_id);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription 
ON subscriptions(stripe_subscription_id);

-- Create function to handle subscription updates from webhooks
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_user_id uuid,
  p_plan_type subscription_plan_type,
  p_status subscription_status,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_start timestamptz DEFAULT NOW(),
  p_period_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate period end if not provided
  IF p_period_end IS NULL THEN
    CASE p_plan_type
      WHEN 'monthly' THEN
        p_period_end := p_period_start + INTERVAL '30 days';
      WHEN 'semiannual' THEN
        p_period_end := p_period_start + INTERVAL '6 months';
      WHEN 'annual' THEN
        p_period_end := p_period_start + INTERVAL '1 year';
      ELSE
        p_period_end := p_period_start + INTERVAL '30 days';
    END CASE;
  END IF;

  -- Upsert subscription
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
    p_period_start,
    p_period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status,
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();
    
  RAISE LOG 'Subscription updated for user: %, plan: %, status: %', p_user_id, p_plan_type, p_status;
END;
$$;