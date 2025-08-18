/*
  # Fix ROI Calculations and Reset Customer Data

  1. Database Changes
    - Remove signup bonus from customer creation
    - Reset all customer data to clean state
    - Update point transaction processing to use correct point values

  2. Data Reset
    - Clear all customers, transactions, and redemptions
    - Remove signup bonus references
*/

-- First, clear all existing data to start fresh
DELETE FROM reward_redemptions;
DELETE FROM transactions;
DELETE FROM customers;

-- Update the customer creation trigger to not give signup bonus
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile without signup bonus
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the process_point_transaction function to use proper point value calculations
CREATE OR REPLACE FUNCTION process_point_transaction(
  p_restaurant_id UUID,
  p_customer_id UUID,
  p_type TEXT,
  p_points INTEGER,
  p_description TEXT DEFAULT '',
  p_amount_spent NUMERIC DEFAULT 0,
  p_reward_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_current_points INTEGER;
  v_new_total INTEGER;
  v_new_lifetime INTEGER;
  v_tier_thresholds JSONB;
  v_new_tier TEXT;
  v_tier_progress INTEGER;
BEGIN
  -- Get current customer data
  SELECT c.total_points, c.lifetime_points, r.settings->'tier_thresholds'
  INTO v_current_points, v_new_lifetime, v_tier_thresholds
  FROM customers c
  JOIN restaurants r ON r.id = c.restaurant_id
  WHERE c.id = p_customer_id AND c.restaurant_id = p_restaurant_id;

  -- Calculate new totals
  v_new_total := v_current_points + p_points;
  
  -- Only update lifetime points for positive transactions
  IF p_points > 0 THEN
    v_new_lifetime := v_new_lifetime + p_points;
  END IF;

  -- Determine new tier based on lifetime points
  v_new_tier := 'bronze';
  v_tier_progress := 0;
  
  IF v_tier_thresholds IS NOT NULL THEN
    IF v_new_lifetime >= COALESCE((v_tier_thresholds->>'gold')::INTEGER, 1000) THEN
      v_new_tier := 'gold';
      v_tier_progress := 100;
    ELSIF v_new_lifetime >= COALESCE((v_tier_thresholds->>'silver')::INTEGER, 500) THEN
      v_new_tier := 'silver';
      v_tier_progress := LEAST(100, (v_new_lifetime * 100) / COALESCE((v_tier_thresholds->>'gold')::INTEGER, 1000));
    ELSE
      v_tier_progress := LEAST(100, (v_new_lifetime * 100) / COALESCE((v_tier_thresholds->>'silver')::INTEGER, 500));
    END IF;
  END IF;

  -- Update customer
  UPDATE customers SET
    total_points = v_new_total,
    lifetime_points = v_new_lifetime,
    current_tier = v_new_tier,
    tier_progress = v_tier_progress,
    total_spent = total_spent + COALESCE(p_amount_spent, 0),
    visit_count = CASE WHEN p_amount_spent > 0 THEN visit_count + 1 ELSE visit_count END,
    last_visit = CASE WHEN p_amount_spent > 0 THEN NOW() ELSE last_visit END,
    updated_at = NOW()
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;

  -- Insert transaction record
  INSERT INTO transactions (
    restaurant_id,
    customer_id,
    type,
    points,
    amount_spent,
    description,
    reward_id,
    branch_id,
    created_at
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    p_type,
    p_points,
    p_amount_spent,
    p_description,
    p_reward_id,
    p_branch_id,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;