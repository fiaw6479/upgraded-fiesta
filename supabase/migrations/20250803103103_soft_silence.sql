/*
  # Add unique constraint for user subscriptions

  1. Database Changes
    - Add unique constraint on user_id in subscriptions table
    - This allows upsert operations to work properly
    - Ensures each user can only have one active subscription

  2. Security
    - Maintains existing RLS policies
    - No changes to access control
*/

-- Add unique constraint on user_id to support upsert operations
ALTER TABLE subscriptions 
ADD CONSTRAINT unique_user_subscription UNIQUE (user_id);