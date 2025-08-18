/*
  # Add Unified Point Value System and Blanket Modes

  1. Restaurant Settings Updates
    - Add pointValueAED (consistent point value across all modes)
    - Add blanket mode configuration
    - Update existing settings structure

  2. Point Calculation Logic
    - Unified point value for all calculations
    - Blanket mode support (smart, manual, spend-based)
    - Priority system: blanket → item-specific → no points
*/

-- Add unified point system settings to restaurants
DO $$
BEGIN
  -- Update restaurant settings to include unified point system
  UPDATE restaurants 
  SET settings = settings || jsonb_build_object(
    'pointValueAED', 0.05,
    'blanketMode', jsonb_build_object(
      'enabled', false,
      'type', 'smart',
      'smartSettings', jsonb_build_object(
        'profitAllocationPercent', 20
      ),
      'manualSettings', jsonb_build_object(
        'pointsPerAED', 0.1
      ),
      'spendSettings', jsonb_build_object(
        'pointsPerAED', 0.2
      )
    ),
    'tierMultipliers', jsonb_build_object(
      'bronze', 1.0,
      'silver', 1.25,
      'gold', 1.5,
      'platinum', 2.0
    )
  )
  WHERE settings IS NOT NULL;
END $$;

-- Create function to calculate points with unified system
CREATE OR REPLACE FUNCTION calculate_points_unified(
  p_restaurant_id uuid,
  p_menu_item_id uuid DEFAULT NULL,
  p_order_amount numeric DEFAULT 0,
  p_customer_tier text DEFAULT 'bronze',
  p_quantity integer DEFAULT 1
) RETURNS integer AS $$
DECLARE
  restaurant_settings jsonb;
  menu_item_record record;
  point_value_aed numeric;
  tier_multiplier numeric;
  base_points integer := 0;
  final_points integer;
BEGIN
  -- Get restaurant settings
  SELECT settings INTO restaurant_settings
  FROM restaurants 
  WHERE id = p_restaurant_id;
  
  IF restaurant_settings IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get point value and tier multiplier
  point_value_aed := COALESCE((restaurant_settings->>'pointValueAED')::numeric, 0.05);
  tier_multiplier := COALESCE((restaurant_settings->'tierMultipliers'->>p_customer_tier)::numeric, 1.0);
  
  -- Check if blanket mode is enabled
  IF COALESCE((restaurant_settings->'blanketMode'->>'enabled')::boolean, false) THEN
    DECLARE
      blanket_type text;
      profit_percent numeric;
      points_per_aed numeric;
      profit_amount numeric;
      reward_value_aed numeric;
    BEGIN
      blanket_type := restaurant_settings->'blanketMode'->>'type';
      
      CASE blanket_type
        WHEN 'smart' THEN
          -- Global smart mode: use average profit calculation
          profit_percent := COALESCE((restaurant_settings->'blanketMode'->'smartSettings'->>'profitAllocationPercent')::numeric, 20);
          -- Estimate 30% profit margin for blanket calculation
          profit_amount := p_order_amount * 0.3;
          reward_value_aed := profit_amount * (profit_percent / 100.0);
          base_points := FLOOR(reward_value_aed / point_value_aed);
          
        WHEN 'manual' THEN
          -- Global manual mode: points per AED spent
          points_per_aed := COALESCE((restaurant_settings->'blanketMode'->'manualSettings'->>'pointsPerAED')::numeric, 0.1);
          base_points := FLOOR(p_order_amount * points_per_aed);
          
        WHEN 'spend' THEN
          -- Global spend-based mode: direct points per AED
          points_per_aed := COALESCE((restaurant_settings->'blanketMode'->'spendSettings'->>'pointsPerAED')::numeric, 0.2);
          base_points := FLOOR(p_order_amount * points_per_aed);
          
        ELSE
          base_points := 0;
      END CASE;
    END;
  ELSE
    -- Check item-specific loyalty settings
    IF p_menu_item_id IS NOT NULL THEN
      SELECT * INTO menu_item_record
      FROM menu_items 
      WHERE id = p_menu_item_id AND restaurant_id = p_restaurant_id;
      
      IF menu_item_record.loyalty_mode = 'smart' THEN
        DECLARE
          profit numeric;
          allocation_percent numeric;
          reward_value_aed numeric;
        BEGIN
          profit := (menu_item_record.selling_price - menu_item_record.cost_price) * p_quantity;
          allocation_percent := COALESCE((menu_item_record.loyalty_settings->>'profit_allocation_percent')::numeric, 0);
          reward_value_aed := profit * (allocation_percent / 100.0);
          base_points := FLOOR(reward_value_aed / point_value_aed);
        END;
      ELSIF menu_item_record.loyalty_mode = 'manual' THEN
        DECLARE
          fixed_points integer;
        BEGIN
          fixed_points := COALESCE((menu_item_record.loyalty_settings->>'fixed_points')::integer, 0);
          base_points := fixed_points * p_quantity;
        END;
      END IF;
    END IF;
  END IF;
  
  -- Apply tier multiplier
  final_points := FLOOR(base_points * tier_multiplier);
  
  RETURN GREATEST(final_points, 0);
END;
$$ LANGUAGE plpgsql;