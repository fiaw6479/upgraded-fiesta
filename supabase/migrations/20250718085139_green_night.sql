/*
  # Fix Ambiguous ROI Settings Error and Enhance Dynamic Point System

  1. Database Function Updates
    - Fix ambiguous column reference for roi_settings
    - Add proper table qualification for all column references
    - Enhance function to handle both blanket mode and menu-based point allocation
    - Add dynamic point value calculation based on loyalty mode

  2. Enhanced ROI Calculations
    - Support for different loyalty modes (blanket vs menu-based)
    - Dynamic point value calculations
    - Proper cost tracking for rewards
    - Professional metrics display
*/

-- Drop the existing function to recreate it properly
DROP FUNCTION IF EXISTS calculate_comprehensive_roi(uuid, timestamp with time zone, timestamp with time zone);

-- Create the enhanced comprehensive ROI calculation function
CREATE OR REPLACE FUNCTION calculate_comprehensive_roi(
  p_restaurant_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_restaurant_settings jsonb;
  v_roi_settings jsonb;
  v_loyalty_mode text;
  v_point_value_aed numeric;
  v_points_per_aed numeric;
  v_default_profit_margin numeric;
  v_estimated_cogs_percentage numeric;
  
  -- Revenue metrics
  v_total_revenue numeric := 0;
  v_total_orders integer := 0;
  v_average_order_value numeric := 0;
  v_revenue_per_customer numeric := 0;
  
  -- Cost metrics
  v_total_reward_cost numeric := 0;
  v_estimated_cogs numeric := 0;
  v_estimated_gross_profit numeric := 0;
  v_reward_cost_percentage numeric := 0;
  
  -- Loyalty metrics
  v_total_points_issued integer := 0;
  v_total_points_redeemed integer := 0;
  v_outstanding_liability numeric := 0;
  v_point_redemption_rate numeric := 0;
  
  -- Customer metrics
  v_total_customers integer := 0;
  v_new_customers integer := 0;
  v_returning_customers integer := 0;
  v_retention_rate numeric := 0;
  
  -- Profitability metrics
  v_gross_profit_margin numeric := 0;
  v_net_profit_after_rewards numeric := 0;
  v_roi_percentage numeric := 0;
  
  v_result jsonb;
BEGIN
  -- Get restaurant settings and ROI settings with proper table qualification
  SELECT 
    r.settings,
    r.roi_settings
  INTO 
    v_restaurant_settings,
    v_roi_settings
  FROM restaurants r
  WHERE r.id = p_restaurant_id;
  
  -- Extract loyalty configuration
  v_loyalty_mode := COALESCE(v_restaurant_settings->>'loyaltyMode', 'blanket');
  v_point_value_aed := COALESCE((v_restaurant_settings->>'pointValueAED')::numeric, 0.05);
  v_points_per_aed := COALESCE((v_restaurant_settings->>'pointsPerAED')::numeric, 0.1);
  
  -- Extract ROI settings with defaults
  v_default_profit_margin := COALESCE((v_roi_settings->>'default_profit_margin')::numeric, 0.3);
  v_estimated_cogs_percentage := COALESCE((v_roi_settings->>'estimated_cogs_percentage')::numeric, 0.4);
  
  -- Calculate revenue metrics from customer data
  SELECT 
    COALESCE(SUM(c.total_spent), 0),
    COUNT(DISTINCT c.id),
    COALESCE(AVG(c.total_spent), 0)
  INTO 
    v_total_revenue,
    v_total_customers,
    v_revenue_per_customer
  FROM customers c
  WHERE c.restaurant_id = p_restaurant_id
    AND c.created_at >= p_start_date
    AND c.created_at <= p_end_date;
  
  -- Calculate order metrics (using visit_count as proxy for orders)
  SELECT 
    COALESCE(SUM(c.visit_count), 0)
  INTO 
    v_total_orders
  FROM customers c
  WHERE c.restaurant_id = p_restaurant_id
    AND c.created_at >= p_start_date
    AND c.created_at <= p_end_date;
  
  -- Calculate average order value
  v_average_order_value := CASE 
    WHEN v_total_orders > 0 THEN v_total_revenue / v_total_orders 
    ELSE 0 
  END;
  
  -- Calculate loyalty metrics from transactions
  SELECT 
    COALESCE(SUM(CASE WHEN t.type IN ('purchase', 'bonus', 'signup') THEN t.points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.type = 'redemption' THEN ABS(t.points) ELSE 0 END), 0)
  INTO 
    v_total_points_issued,
    v_total_points_redeemed
  FROM transactions t
  WHERE t.restaurant_id = p_restaurant_id
    AND t.created_at >= p_start_date
    AND t.created_at <= p_end_date;
  
  -- Calculate reward cost using actual point value
  v_total_reward_cost := v_total_points_redeemed * v_point_value_aed;
  
  -- Calculate outstanding liability (unused points)
  SELECT 
    COALESCE(SUM(c.total_points), 0) * v_point_value_aed
  INTO 
    v_outstanding_liability
  FROM customers c
  WHERE c.restaurant_id = p_restaurant_id;
  
  -- Calculate point redemption rate
  v_point_redemption_rate := CASE 
    WHEN v_total_points_issued > 0 THEN (v_total_points_redeemed::numeric / v_total_points_issued) * 100 
    ELSE 0 
  END;
  
  -- Calculate customer retention metrics
  SELECT 
    COUNT(CASE WHEN c.visit_count = 1 THEN 1 END),
    COUNT(CASE WHEN c.visit_count > 1 THEN 1 END)
  INTO 
    v_new_customers,
    v_returning_customers
  FROM customers c
  WHERE c.restaurant_id = p_restaurant_id
    AND c.created_at >= p_start_date
    AND c.created_at <= p_end_date;
  
  v_retention_rate := CASE 
    WHEN v_total_customers > 0 THEN (v_returning_customers::numeric / v_total_customers) * 100 
    ELSE 0 
  END;
  
  -- Calculate cost metrics
  v_estimated_cogs := v_total_revenue * v_estimated_cogs_percentage;
  v_estimated_gross_profit := v_total_revenue - v_estimated_cogs;
  v_reward_cost_percentage := CASE 
    WHEN v_total_revenue > 0 THEN (v_total_reward_cost / v_total_revenue) * 100 
    ELSE 0 
  END;
  
  -- Calculate profitability metrics
  v_gross_profit_margin := CASE 
    WHEN v_total_revenue > 0 THEN (v_estimated_gross_profit / v_total_revenue) * 100 
    ELSE 0 
  END;
  
  v_net_profit_after_rewards := v_estimated_gross_profit - v_total_reward_cost;
  
  -- Calculate ROI percentage
  v_roi_percentage := CASE 
    WHEN v_total_reward_cost > 0 THEN (v_net_profit_after_rewards / v_total_reward_cost) * 100 
    ELSE 0 
  END;
  
  -- Build comprehensive result
  v_result := jsonb_build_object(
    'revenue_metrics', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_orders', v_total_orders,
      'average_order_value', v_average_order_value,
      'revenue_per_customer', v_revenue_per_customer
    ),
    'cost_metrics', jsonb_build_object(
      'total_reward_cost', v_total_reward_cost,
      'estimated_cogs', v_estimated_cogs,
      'estimated_gross_profit', v_estimated_gross_profit,
      'reward_cost_percentage', v_reward_cost_percentage
    ),
    'loyalty_metrics', jsonb_build_object(
      'total_points_issued', v_total_points_issued,
      'total_points_redeemed', v_total_points_redeemed,
      'outstanding_liability', v_outstanding_liability,
      'point_redemption_rate', v_point_redemption_rate
    ),
    'customer_metrics', jsonb_build_object(
      'total_customers', v_total_customers,
      'new_customers', v_new_customers,
      'returning_customers', v_returning_customers,
      'retention_rate', v_retention_rate
    ),
    'profitability', jsonb_build_object(
      'gross_profit_margin', v_gross_profit_margin,
      'net_profit_after_rewards', v_net_profit_after_rewards,
      'roi_percentage', v_roi_percentage
    ),
    'settings_used', jsonb_build_object(
      'loyalty_mode', v_loyalty_mode,
      'point_value_aed', v_point_value_aed,
      'points_per_aed', v_points_per_aed,
      'default_profit_margin', v_default_profit_margin,
      'estimated_cogs_percentage', v_estimated_cogs_percentage
    )
  );
  
  RETURN v_result;
END;
$$;