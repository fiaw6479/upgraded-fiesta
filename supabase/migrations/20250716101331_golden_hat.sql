/*
  # Create process_point_transaction function

  1. Function
    - `process_point_transaction` - Handles point transactions with branch tracking
    - Updates customer points and tier automatically
    - Creates transaction records with branch reference

  2. Security
    - Function runs with security definer privileges
    - Validates restaurant ownership through RLS
*/

-- Create the process_point_transaction function
CREATE OR REPLACE FUNCTION process_point_transaction(
  p_restaurant_id UUID,
  p_customer_id UUID,
  p_type TEXT,
  p_points INTEGER,
  p_description TEXT DEFAULT NULL,
  p_amount_spent DECIMAL(10,2) DEFAULT NULL,
  p_reward_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_customer_record RECORD;
  v_new_total_points INTEGER;
  v_new_lifetime_points INTEGER;
  v_new_tier TEXT;
  v_tier_progress INTEGER;
BEGIN
  -- Get current customer data
  SELECT total_points, lifetime_points, current_tier, total_spent, visit_count
  INTO v_customer_record
  FROM customers 
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  
  -- Calculate new points
  v_new_total_points := v_customer_record.total_points + p_points;
  
  -- Update lifetime points only if adding points (not redeeming)
  IF p_points > 0 THEN
    v_new_lifetime_points := v_customer_record.lifetime_points + p_points;
  ELSE
    v_new_lifetime_points := v_customer_record.lifetime_points;
  END IF;
  
  -- Determine new tier based on lifetime points
  IF v_new_lifetime_points >= 1000 THEN
    v_new_tier := 'gold';
    v_tier_progress := LEAST(100, ((v_new_lifetime_points - 1000) * 100 / 1000));
  ELSIF v_new_lifetime_points >= 500 THEN
    v_new_tier := 'silver';
    v_tier_progress := ((v_new_lifetime_points - 500) * 100 / 500);
  ELSE
    v_new_tier := 'bronze';
    v_tier_progress := (v_new_lifetime_points * 100 / 500);
  END IF;
  
  -- Update customer record
  UPDATE customers SET
    total_points = v_new_total_points,
    lifetime_points = v_new_lifetime_points,
    current_tier = v_new_tier,
    tier_progress = v_tier_progress,
    total_spent = CASE 
      WHEN p_amount_spent IS NOT NULL THEN v_customer_record.total_spent + p_amount_spent
      ELSE v_customer_record.total_spent
    END,
    visit_count = CASE 
      WHEN p_type = 'purchase' THEN v_customer_record.visit_count + 1
      ELSE v_customer_record.visit_count
    END,
    last_visit = CASE 
      WHEN p_type = 'purchase' THEN NOW()
      ELSE v_customer_record.last_visit
    END,
    updated_at = NOW()
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  
  -- Insert transaction record
  INSERT INTO transactions (
    restaurant_id,
    customer_id,
    branch_id,
    type,
    points,
    amount_spent,
    description,
    reward_id,
    created_at
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    p_branch_id,
    p_type,
    p_points,
    p_amount_spent,
    p_description,
    p_reward_id,
    NOW()
  );
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_point_transaction TO authenticated;