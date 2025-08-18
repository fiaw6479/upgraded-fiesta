/*
  # Reset Loyalty Data and Remove Signup Bonuses

  1. Data Reset
    - Remove all existing reward redemptions
    - Reset customer points to 0
    - Clear transaction history
  
  2. Remove Signup Bonuses
    - Remove signup bonus transactions
    - Reset customer balances
    
  3. Update Restaurant Settings
    - Remove old point configuration
    - Prepare for new reward engine settings
*/

-- Reset all customer points and lifetime points
UPDATE customers SET 
  total_points = 0,
  lifetime_points = 0,
  tier_progress = 0,
  visit_count = 0,
  total_spent = 0,
  last_visit = NULL;

-- Delete all transactions (including signup bonuses)
DELETE FROM transactions;

-- Delete all reward redemptions
DELETE FROM reward_redemptions;

-- Reset reward redemption counts
UPDATE rewards SET total_redeemed = 0;

-- Update restaurant settings to remove old point configuration
UPDATE restaurants SET 
  settings = jsonb_set(
    COALESCE(settings, '{}'),
    '{points_per_dollar}',
    'null'
  );

-- Remove signup bonus from settings
UPDATE restaurants SET 
  settings = settings - 'signup_bonus';

-- Remove referral bonus from settings  
UPDATE restaurants SET 
  settings = settings - 'referral_bonus';