/*
  # Fix process_point_transaction function

  1. Database Function Fixes
    - Fix ambiguous column reference for current_tier
    - Ensure consistent function signature
    - Add proper table qualifiers

  2. Function Signature
    - Standardize parameters across all calls
    - Include branch_id parameter consistently
*/

-- Drop existing function to recreate with fixes
DROP FUNCTION IF EXISTS process_point_transaction(uuid, uuid, text, integer, text, numeric, uuid, uuid);
DROP FUNCTION IF EXISTS process_point_transaction(uuid, uuid, text, integer, numeric, text, uuid);

-- Create the corrected function with consistent signature
CREATE OR REPLACE FUNCTION process_point_transaction(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_type text,
  p_points integer,
  p_description text DEFAULT '',
  p_amount_spent numeric DEFAULT 0,
  p_reward_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_tier text;
  v_current_points integer;
  v_lifetime_points integer;
  v_new_total_points integer;
  v_new_lifetime_points integer;
BEGIN
  -- Get current customer data with proper table qualification
  SELECT c.current_tier, c.total_points, c.lifetime_points
  INTO v_customer_tier, v_current_points, v_lifetime_points
  FROM customers c
  WHERE c.id = p_customer_id AND c.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Calculate new point totals
  v_new_total_points := v_current_points + p_points;
  
  -- Only update lifetime points for positive transactions
  IF p_points > 0 THEN
    v_new_lifetime_points := v_lifetime_points + p_points;
  ELSE
    v_new_lifetime_points := v_lifetime_points;
  END IF;

  -- Ensure points don't go negative
  IF v_new_total_points < 0 THEN
    RAISE EXCEPTION 'Insufficient points for this transaction';
  END IF;

  -- Insert transaction record
  INSERT INTO transactions (
    restaurant_id,
    customer_id,
    type,
    points,
    amount_spent,
    description,
    reward_id,
    branch_id
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    p_type,
    p_points,
    p_amount_spent,
    p_description,
    p_reward_id,
    p_branch_id
  );

  -- Update customer points and stats
  UPDATE customers c
  SET 
    total_points = v_new_total_points,
    lifetime_points = v_new_lifetime_points,
    visit_count = CASE 
      WHEN p_type = 'purchase' THEN c.visit_count + 1 
      ELSE c.visit_count 
    END,
    total_spent = CASE 
      WHEN p_amount_spent > 0 THEN c.total_spent + p_amount_spent 
      ELSE c.total_spent 
    END,
    last_visit = CASE 
      WHEN p_type = 'purchase' THEN NOW() 
      ELSE c.last_visit 
    END,
    updated_at = NOW()
  WHERE c.id = p_customer_id AND c.restaurant_id = p_restaurant_id;

END;
$$;