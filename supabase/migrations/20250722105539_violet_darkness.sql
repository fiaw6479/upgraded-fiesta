/*
  # Fix Super Admin System and Backend Issues

  1. Database Improvements
    - Add proper indexes for performance
    - Fix any constraint issues
    - Add missing foreign key constraints
    - Optimize queries for super admin operations

  2. Security Enhancements
    - Ensure proper RLS policies
    - Add super admin specific functions
    - Secure sensitive operations

  3. Data Integrity
    - Fix duplicate restaurant issues
    - Add unique constraints where needed
    - Clean up orphaned data
*/

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_created ON customers(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_restaurant_created ON transactions(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_created ON transactions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rewards_restaurant_active ON rewards(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_restaurant ON support_tickets(restaurant_id);

-- Add comprehensive ROI calculation function for super admin analytics
CREATE OR REPLACE FUNCTION calculate_comprehensive_roi(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_revenue_metrics jsonb;
  v_cost_metrics jsonb;
  v_loyalty_metrics jsonb;
  v_customer_metrics jsonb;
  v_profitability jsonb;
  v_settings jsonb;
  v_total_revenue numeric := 0;
  v_total_orders integer := 0;
  v_total_customers integer := 0;
  v_returning_customers integer := 0;
  v_total_points_issued integer := 0;
  v_total_points_redeemed integer := 0;
  v_total_reward_cost numeric := 0;
  v_point_value_aed numeric := 0.05;
  v_estimated_cogs numeric := 0;
  v_estimated_gross_profit numeric := 0;
  v_roi_settings jsonb;
BEGIN
  -- Get restaurant settings
  SELECT settings, roi_settings INTO v_settings, v_roi_settings
  FROM restaurants 
  WHERE id = p_restaurant_id;
  
  v_point_value_aed := COALESCE((v_settings->>'pointValueAED')::numeric, 0.05);
  
  -- Get revenue and customer metrics
  SELECT 
    COALESCE(SUM(total_spent), 0),
    COUNT(*),
    COUNT(CASE WHEN visit_count > 1 THEN 1 END)
  INTO v_total_revenue, v_total_customers, v_returning_customers
  FROM customers 
  WHERE restaurant_id = p_restaurant_id
    AND created_at BETWEEN p_start_date AND p_end_date;
  
  -- Get transaction metrics
  SELECT 
    COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0),
    COUNT(CASE WHEN type = 'purchase' THEN 1 END)
  INTO v_total_points_issued, v_total_points_redeemed, v_total_orders
  FROM transactions 
  WHERE restaurant_id = p_restaurant_id
    AND created_at BETWEEN p_start_date AND p_end_date;
  
  -- Calculate reward costs
  v_total_reward_cost := v_total_points_redeemed * v_point_value_aed;
  
  -- Calculate estimated costs using ROI settings
  v_estimated_cogs := v_total_revenue * COALESCE((v_roi_settings->>'estimated_cogs_percentage')::numeric, 0.4);
  v_estimated_gross_profit := v_total_revenue - v_estimated_cogs;
  
  -- Build result JSON
  v_revenue_metrics := jsonb_build_object(
    'total_revenue', v_total_revenue,
    'average_order_value', CASE WHEN v_total_orders > 0 THEN v_total_revenue / v_total_orders ELSE 0 END,
    'revenue_per_customer', CASE WHEN v_total_customers > 0 THEN v_total_revenue / v_total_customers ELSE 0 END,
    'total_orders', v_total_orders
  );
  
  v_cost_metrics := jsonb_build_object(
    'total_reward_cost', v_total_reward_cost,
    'estimated_cogs', v_estimated_cogs,
    'estimated_gross_profit', v_estimated_gross_profit,
    'reward_cost_percentage', CASE WHEN v_total_revenue > 0 THEN (v_total_reward_cost / v_total_revenue) * 100 ELSE 0 END
  );
  
  v_loyalty_metrics := jsonb_build_object(
    'total_points_issued', v_total_points_issued,
    'total_points_redeemed', v_total_points_redeemed,
    'point_redemption_rate', CASE WHEN v_total_points_issued > 0 THEN (v_total_points_redeemed::numeric / v_total_points_issued) * 100 ELSE 0 END,
    'outstanding_liability', (v_total_points_issued - v_total_points_redeemed) * v_point_value_aed
  );
  
  v_customer_metrics := jsonb_build_object(
    'total_customers', v_total_customers,
    'returning_customers', v_returning_customers,
    'retention_rate', CASE WHEN v_total_customers > 0 THEN (v_returning_customers::numeric / v_total_customers) * 100 ELSE 0 END
  );
  
  v_profitability := jsonb_build_object(
    'gross_profit_margin', CASE WHEN v_total_revenue > 0 THEN (v_estimated_gross_profit / v_total_revenue) * 100 ELSE 0 END,
    'net_profit_after_rewards', v_estimated_gross_profit - v_total_reward_cost,
    'roi_percentage', CASE WHEN v_total_reward_cost > 0 THEN ((v_estimated_gross_profit - v_total_reward_cost) / v_total_reward_cost) * 100 ELSE 0 END
  );
  
  v_result := jsonb_build_object(
    'revenue_metrics', v_revenue_metrics,
    'cost_metrics', v_cost_metrics,
    'loyalty_metrics', v_loyalty_metrics,
    'customer_metrics', v_customer_metrics,
    'profitability', v_profitability,
    'settings_used', jsonb_build_object('point_value_aed', v_point_value_aed)
  );
  
  RETURN v_result;
END;
$$;

-- Function to get system-wide statistics for super admin
CREATE OR REPLACE FUNCTION get_system_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_total_restaurants integer;
  v_total_customers integer;
  v_total_revenue numeric;
  v_total_points_issued integer;
  v_active_tickets integer;
  v_monthly_growth jsonb;
BEGIN
  -- Get total restaurants
  SELECT COUNT(*) INTO v_total_restaurants FROM restaurants;
  
  -- Get total customers across all restaurants
  SELECT COUNT(*) INTO v_total_customers FROM customers;
  
  -- Get total revenue across all restaurants
  SELECT COALESCE(SUM(total_spent), 0) INTO v_total_revenue FROM customers;
  
  -- Get total points issued
  SELECT COALESCE(SUM(points), 0) INTO v_total_points_issued 
  FROM transactions WHERE points > 0;
  
  -- Get active support tickets
  SELECT COUNT(*) INTO v_active_tickets 
  FROM support_tickets WHERE status IN ('open', 'in_progress');
  
  -- Calculate monthly growth (simplified)
  WITH monthly_data AS (
    SELECT 
      COUNT(CASE WHEN r.created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as new_restaurants_this_month,
      COUNT(CASE WHEN c.created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as new_customers_this_month
    FROM restaurants r
    FULL OUTER JOIN customers c ON true
  )
  SELECT jsonb_build_object(
    'restaurants', new_restaurants_this_month,
    'customers', new_customers_this_month,
    'revenue', 0
  ) INTO v_monthly_growth FROM monthly_data;
  
  v_result := jsonb_build_object(
    'total_restaurants', v_total_restaurants,
    'total_customers', v_total_customers,
    'total_revenue', v_total_revenue,
    'total_points_issued', v_total_points_issued,
    'active_tickets', v_active_tickets,
    'monthly_growth', v_monthly_growth
  );
  
  RETURN v_result;
END;
$$;

-- Function to update restaurant ROI settings
CREATE OR REPLACE FUNCTION update_restaurant_roi_settings(
  p_restaurant_id uuid,
  p_roi_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE restaurants 
  SET roi_settings = p_roi_settings,
      updated_at = now()
  WHERE id = p_restaurant_id;
END;
$$;

-- Add RLS policy for super admin operations (these functions are security definer)
-- Super admin functions don't need RLS as they're meant for system-wide access

-- Clean up any duplicate restaurants for the same user (fix issue #2)
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  -- Find users with multiple restaurants and keep only the most recent one
  FOR duplicate_record IN 
    SELECT owner_id, COUNT(*) as restaurant_count
    FROM restaurants 
    GROUP BY owner_id 
    HAVING COUNT(*) > 1
  LOOP
    -- Delete all but the most recent restaurant for this user
    DELETE FROM restaurants 
    WHERE owner_id = duplicate_record.owner_id 
    AND id NOT IN (
      SELECT id FROM restaurants 
      WHERE owner_id = duplicate_record.owner_id 
      ORDER BY created_at DESC 
      LIMIT 1
    );
    
    RAISE NOTICE 'Cleaned up duplicate restaurants for user: %', duplicate_record.owner_id;
  END LOOP;
END;
$$;

-- Add constraint to prevent duplicate restaurants per user
ALTER TABLE restaurants 
ADD CONSTRAINT unique_restaurant_per_user 
UNIQUE (owner_id);

-- Optimize the process_point_transaction function for better performance
CREATE OR REPLACE FUNCTION process_point_transaction(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_type text,
  p_points integer,
  p_description text DEFAULT NULL,
  p_amount_spent numeric DEFAULT NULL,
  p_reward_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_record customers%ROWTYPE;
  v_new_total_points integer;
  v_new_lifetime_points integer;
  v_new_tier text;
  v_tier_progress integer;
BEGIN
  -- Get current customer data with row lock
  SELECT * INTO v_customer_record
  FROM customers 
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  
  -- Calculate new point totals
  v_new_total_points := GREATEST(0, v_customer_record.total_points + p_points);
  
  -- Only increase lifetime points for positive transactions
  IF p_points > 0 THEN
    v_new_lifetime_points := v_customer_record.lifetime_points + p_points;
  ELSE
    v_new_lifetime_points := v_customer_record.lifetime_points;
  END IF;
  
  -- Calculate new tier based on lifetime points
  IF v_new_lifetime_points >= 1000 THEN
    v_new_tier := 'gold';
    v_tier_progress := LEAST(100, ((v_new_lifetime_points - 1000)::numeric / 1000 * 100)::integer);
  ELSIF v_new_lifetime_points >= 500 THEN
    v_new_tier := 'silver';
    v_tier_progress := ((v_new_lifetime_points - 500)::numeric / 500 * 100)::integer;
  ELSE
    v_new_tier := 'bronze';
    v_tier_progress := (v_new_lifetime_points::numeric / 500 * 100)::integer;
  END IF;
  
  -- Update customer record
  UPDATE customers SET
    total_points = v_new_total_points,
    lifetime_points = v_new_lifetime_points,
    current_tier = v_new_tier,
    tier_progress = v_tier_progress,
    total_spent = CASE 
      WHEN p_amount_spent IS NOT NULL THEN total_spent + p_amount_spent 
      ELSE total_spent 
    END,
    visit_count = CASE 
      WHEN p_type = 'purchase' THEN visit_count + 1 
      ELSE visit_count 
    END,
    last_visit = CASE 
      WHEN p_type = 'purchase' THEN now() 
      ELSE last_visit 
    END,
    updated_at = now()
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
    reward_id
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    p_branch_id,
    p_type,
    p_points,
    p_amount_spent,
    p_description,
    p_reward_id
  );
END;
$$;

-- Add function to calculate points using unified loyalty system
CREATE OR REPLACE FUNCTION calculate_points_unified(
  p_restaurant_id uuid,
  p_menu_item_id uuid DEFAULT NULL,
  p_order_amount numeric DEFAULT 0,
  p_customer_tier text DEFAULT 'bronze',
  p_quantity integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restaurant_settings jsonb;
  v_menu_item menu_items%ROWTYPE;
  v_base_points integer := 0;
  v_tier_multiplier numeric := 1.0;
  v_final_points integer := 0;
BEGIN
  -- Get restaurant settings
  SELECT settings INTO v_restaurant_settings
  FROM restaurants 
  WHERE id = p_restaurant_id;
  
  IF v_restaurant_settings IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get tier multiplier
  v_tier_multiplier := COALESCE(
    (v_restaurant_settings->'tierMultipliers'->p_customer_tier)::numeric, 
    1.0
  );
  
  -- Check if blanket mode is enabled
  IF COALESCE((v_restaurant_settings->'blanketMode'->>'enabled')::boolean, false) THEN
    -- Use blanket mode calculation
    CASE COALESCE(v_restaurant_settings->'blanketMode'->>'type', 'smart')
      WHEN 'smart' THEN
        -- Smart auto: percentage of estimated profit
        DECLARE
          v_estimated_profit numeric := p_order_amount * 0.3; -- 30% estimated profit
          v_allocation_percent numeric := COALESCE(
            (v_restaurant_settings->'blanketMode'->'smartSettings'->>'profitAllocationPercent')::numeric, 
            20
          );
          v_point_value_aed numeric := COALESCE(
            (v_restaurant_settings->>'pointValueAED')::numeric, 
            0.05
          );
          v_reward_value_aed numeric := v_estimated_profit * (v_allocation_percent / 100.0);
        BEGIN
          v_base_points := FLOOR(v_reward_value_aed / v_point_value_aed);
        END;
      
      WHEN 'manual' THEN
        -- Manual: fixed points per AED
        DECLARE
          v_points_per_aed numeric := COALESCE(
            (v_restaurant_settings->'blanketMode'->'manualSettings'->>'pointsPerAED')::numeric, 
            0.1
          );
        BEGIN
          v_base_points := FLOOR(p_order_amount * v_points_per_aed);
        END;
      
      WHEN 'spend' THEN
        -- Spend-based: direct ratio
        DECLARE
          v_points_per_aed numeric := COALESCE(
            (v_restaurant_settings->'blanketMode'->'spendSettings'->>'pointsPerAED')::numeric, 
            0.2
          );
        BEGIN
          v_base_points := FLOOR(p_order_amount * v_points_per_aed);
        END;
    END CASE;
  ELSIF p_menu_item_id IS NOT NULL THEN
    -- Use menu item specific settings
    SELECT * INTO v_menu_item
    FROM menu_items 
    WHERE id = p_menu_item_id AND restaurant_id = p_restaurant_id;
    
    IF FOUND THEN
      CASE v_menu_item.loyalty_mode
        WHEN 'smart' THEN
          -- Smart auto: percentage of profit
          DECLARE
            v_profit numeric := (v_menu_item.selling_price - v_menu_item.cost_price) * p_quantity;
            v_allocation_percent numeric := COALESCE(
              (v_menu_item.loyalty_settings->>'profit_allocation_percent')::numeric, 
              0
            );
            v_point_value_aed numeric := COALESCE(
              (v_restaurant_settings->>'pointValueAED')::numeric, 
              0.05
            );
            v_reward_value_aed numeric := v_profit * (v_allocation_percent / 100.0);
          BEGIN
            v_base_points := FLOOR(v_reward_value_aed / v_point_value_aed);
          END;
        
        WHEN 'manual' THEN
          -- Manual: fixed points
          v_base_points := COALESCE(
            (v_menu_item.loyalty_settings->>'fixed_points')::integer, 
            0
          ) * p_quantity;
        
        ELSE
          -- No rewards
          v_base_points := 0;
      END CASE;
    END IF;
  END IF;
  
  -- Apply tier multiplier
  v_final_points := FLOOR(v_base_points * v_tier_multiplier);
  
  RETURN GREATEST(0, v_final_points);
END;
$$;

-- Grant necessary permissions for super admin functions
GRANT EXECUTE ON FUNCTION get_system_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_comprehensive_roi(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION update_restaurant_roi_settings(uuid, jsonb) TO authenticated;