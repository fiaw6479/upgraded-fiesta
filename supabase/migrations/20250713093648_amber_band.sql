/*
  # Add Loyalty Reward Engine Configuration

  1. Restaurant Reward Settings
    - Add reward mode configuration (smart/manual)
    - Add smart calculation settings
    - Add manual ratio settings
    - Add tier multipliers
  
  2. Enhanced Customer Tiers
    - Add Platinum tier option
    - Update tier constraints
    
  3. Point Calculation Functions
    - Add function to calculate points based on settings
    - Add tier multiplier application
*/

-- Add new tier option (Platinum)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'customers_current_tier_check'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_current_tier_check;
  END IF;
END $$;

ALTER TABLE customers ADD CONSTRAINT customers_current_tier_check 
  CHECK (current_tier = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text]));

-- Update rewards table to include platinum tier
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'rewards_min_tier_check'
  ) THEN
    ALTER TABLE rewards DROP CONSTRAINT rewards_min_tier_check;
  END IF;
END $$;

ALTER TABLE rewards ADD CONSTRAINT rewards_min_tier_check 
  CHECK (min_tier = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text]));

-- Add default reward engine settings to all restaurants
UPDATE restaurants SET 
  settings = jsonb_set(
    COALESCE(settings, '{}'),
    '{reward_engine}',
    '{
      "mode": "manual",
      "smart_settings": {
        "cost_price": 0,
        "selling_price": 0,
        "profit_allocation_percent": 20
      },
      "manual_settings": {
        "aed_value": 10,
        "point_value": 1
      },
      "tier_multipliers": {
        "bronze": 1.0,
        "silver": 1.25,
        "gold": 1.5,
        "platinum": 2.0
      },
      "max_points_per_order": 1000
    }'::jsonb
  );

-- Create function to calculate points based on reward engine settings
CREATE OR REPLACE FUNCTION calculate_points_for_order(
  p_restaurant_id UUID,
  p_order_amount DECIMAL,
  p_customer_tier TEXT DEFAULT 'bronze'
) RETURNS INTEGER AS $$
DECLARE
  v_settings JSONB;
  v_reward_engine JSONB;
  v_base_points INTEGER;
  v_tier_multiplier DECIMAL;
  v_final_points INTEGER;
BEGIN
  -- Get restaurant settings
  SELECT settings INTO v_settings
  FROM restaurants
  WHERE id = p_restaurant_id;
  
  -- Get reward engine configuration
  v_reward_engine := v_settings->'reward_engine';
  
  -- Calculate base points based on mode
  IF (v_reward_engine->>'mode') = 'smart' THEN
    -- Smart mode: profit-based calculation
    DECLARE
      v_cost_price DECIMAL := (v_reward_engine->'smart_settings'->>'cost_price')::DECIMAL;
      v_selling_price DECIMAL := (v_reward_engine->'smart_settings'->>'selling_price')::DECIMAL;
      v_profit_percent DECIMAL := (v_reward_engine->'smart_settings'->>'profit_allocation_percent')::DECIMAL;
      v_profit DECIMAL;
      v_reward_value DECIMAL;
    BEGIN
      -- Calculate profit per unit and scale to order amount
      v_profit := (v_selling_price - v_cost_price) * (p_order_amount / v_selling_price);
      v_reward_value := v_profit * (v_profit_percent / 100.0);
      v_base_points := FLOOR(v_reward_value);
    END;
  ELSE
    -- Manual mode: AED-to-point ratio
    DECLARE
      v_aed_value DECIMAL := (v_reward_engine->'manual_settings'->>'aed_value')::DECIMAL;
      v_point_value DECIMAL := (v_reward_engine->'manual_settings'->>'point_value')::DECIMAL;
    BEGIN
      v_base_points := FLOOR((p_order_amount / v_aed_value) * v_point_value);
    END;
  END IF;
  
  -- Apply tier multiplier
  v_tier_multiplier := COALESCE(
    (v_reward_engine->'tier_multipliers'->>p_customer_tier)::DECIMAL,
    1.0
  );
  
  v_final_points := FLOOR(v_base_points * v_tier_multiplier);
  
  -- Apply maximum points per order limit
  IF v_final_points > COALESCE((v_reward_engine->>'max_points_per_order')::INTEGER, 1000) THEN
    v_final_points := COALESCE((v_reward_engine->>'max_points_per_order')::INTEGER, 1000);
  END IF;
  
  RETURN GREATEST(v_final_points, 0);
END;
$$ LANGUAGE plpgsql;