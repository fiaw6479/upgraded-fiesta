/*
  # Fix subscription foreign key relationships and webhook handling

  1. Database Schema Updates
    - Add foreign key constraint from subscriptions.user_id to auth.users(id)
    - Ensure proper indexing for performance
    - Add unique constraint on user_id for proper upsert behavior

  2. Security
    - Update RLS policies to work with foreign key relationships
    - Ensure proper access control for subscription data

  3. Webhook Support
    - Database structure now supports proper subscription updates from Stripe webhooks
    - Unique constraint on user_id ensures upserts work correctly (trial → paid upgrades)
*/

-- Add foreign key constraint from subscriptions to auth.users if it doesn't exist
DO $$
BEGIN
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

-- Ensure unique constraint on user_id exists (critical for webhook upserts)
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

-- Add index on user_id for better performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_subscriptions_user_id'
  ) THEN
    CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
  END IF;
END $$;

-- Add index on stripe_subscription_id for webhook lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_subscriptions_stripe_subscription'
  ) THEN
    CREATE INDEX idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
  END IF;
END $$;

-- Update RLS policies to work with the foreign key relationship
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON subscriptions;

-- Policy for users to manage their own subscriptions
CREATE POLICY "Users can manage own subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy for service role to manage all subscriptions (needed for webhooks)
CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);