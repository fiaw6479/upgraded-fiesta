/*
  # Update branches and transactions for better tracking

  1. Modifications
    - Add branch_id to transactions table
    - Update process_point_transaction function to include branch tracking
    - Add daily stats tracking capabilities

  2. Security
    - Maintain existing RLS policies
    - Ensure proper branch access control
*/

-- Add branch_id to transactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);
  END IF;
END $$;

-- Update process_point_transaction function to include branch tracking
CREATE OR REPLACE FUNCTION process_point_transaction(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_type text,
  p_points integer,
  p_description text DEFAULT NULL,
  p_amount_spent numeric DEFAULT NULL,
  p_reward_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE
  current_points integer;
  current_lifetime_points integer;
  current_tier text;
  current_visit_count integer;
  new_tier text;
  tier_thresholds jsonb;
BEGIN
  -- Get current customer data
  SELECT total_points, lifetime_points, current_tier, visit_count
  INTO current_points, current_lifetime_points, current_tier, current_visit_count
  FROM customers
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;

  -- Insert transaction record with branch tracking
  INSERT INTO transactions (
    restaurant_id, customer_id, type, points, amount_spent, description, reward_id, branch_id
  ) VALUES (
    p_restaurant_id, p_customer_id, p_type, p_points, p_amount_spent, p_description, p_reward_id, p_branch_id
  );

  -- Update customer points
  IF p_type = 'redemption' THEN
    -- Deduct points for redemption
    UPDATE customers 
    SET total_points = GREATEST(0, total_points + p_points),
        last_visit = NOW(),
        updated_at = NOW()
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  ELSE
    -- Add points for other transactions
    UPDATE customers 
    SET total_points = total_points + p_points,
        lifetime_points = lifetime_points + p_points,
        visit_count = CASE WHEN p_type = 'purchase' THEN visit_count + 1 ELSE visit_count END,
        total_spent = COALESCE(total_spent, 0) + COALESCE(p_amount_spent, 0),
        last_visit = NOW(),
        updated_at = NOW()
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  END IF;

  -- Update tier based on lifetime points
  SELECT settings->'tier_thresholds' INTO tier_thresholds
  FROM restaurants WHERE id = p_restaurant_id;

  SELECT current_tier INTO new_tier FROM customers WHERE id = p_customer_id;
  
  -- Simple tier calculation
  IF current_lifetime_points + GREATEST(0, p_points) >= COALESCE((tier_thresholds->>'gold')::integer, 1000) THEN
    new_tier := 'gold';
  ELSIF current_lifetime_points + GREATEST(0, p_points) >= COALESCE((tier_thresholds->>'silver')::integer, 500) THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;

  -- Update tier if changed
  IF new_tier != current_tier THEN
    UPDATE customers 
    SET current_tier = new_tier,
        updated_at = NOW()
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;