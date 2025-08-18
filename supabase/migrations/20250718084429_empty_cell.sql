/*
  # Fix Authentication and Create Comprehensive ROI System

  1. Database Functions
    - Fix user creation trigger
    - Create comprehensive ROI calculation functions
    - Add profit margin tracking for restaurants

  2. ROI Tracking
    - Add restaurant-level profit margins
    - Create functions to calculate accurate ROI
    - Handle cases where cost data is missing

  3. Security
    - Ensure RLS policies work correctly
    - Fix any auth-related issues
*/

-- Fix the user creation trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create user record, don't create restaurant here
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth process
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add comprehensive ROI tracking fields to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS roi_settings JSONB DEFAULT '{
  "default_profit_margin": 0.3,
  "estimated_cogs_percentage": 0.4,
  "labor_cost_percentage": 0.25,
  "overhead_percentage": 0.15,
  "target_roi_percentage": 200
}'::jsonb;

-- Create comprehensive ROI calculation function
CREATE OR REPLACE FUNCTION calculate_comprehensive_roi(
  p_restaurant_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  restaurant_settings JSONB;
  roi_settings JSONB;
  point_value_aed DECIMAL;
  default_profit_margin DECIMAL;
  
  -- Revenue metrics
  total_revenue DECIMAL := 0;
  total_orders INTEGER := 0;
  
  -- Cost metrics
  total_reward_cost DECIMAL := 0;
  total_points_issued INTEGER := 0;
  total_points_redeemed INTEGER := 0;
  
  -- Customer metrics
  total_customers INTEGER := 0;
  returning_customers INTEGER := 0;
  
  -- Calculated metrics
  estimated_cogs DECIMAL := 0;
  estimated_gross_profit DECIMAL := 0;
  net_profit_after_rewards DECIMAL := 0;
  roi_percentage DECIMAL := 0;
  
  result JSONB;
BEGIN
  -- Get restaurant settings
  SELECT settings, COALESCE(roi_settings, '{}'::jsonb)
  INTO restaurant_settings, roi_settings
  FROM restaurants 
  WHERE id = p_restaurant_id;
  
  -- Extract key values with defaults
  point_value_aed := COALESCE((restaurant_settings->>'pointValueAED')::decimal, 0.05);
  default_profit_margin := COALESCE((roi_settings->>'default_profit_margin')::decimal, 0.3);
  
  -- Calculate revenue from customer spending
  SELECT 
    COALESCE(SUM(total_spent), 0),
    COUNT(*)
  INTO total_revenue, total_customers
  FROM customers 
  WHERE restaurant_id = p_restaurant_id
    AND created_at >= p_start_date 
    AND created_at <= p_end_date;
  
  -- Calculate returning customers
  SELECT COUNT(*)
  INTO returning_customers
  FROM customers 
  WHERE restaurant_id = p_restaurant_id
    AND visit_count > 1
    AND created_at >= p_start_date 
    AND created_at <= p_end_date;
  
  -- Calculate total orders from transactions
  SELECT COUNT(DISTINCT id)
  INTO total_orders
  FROM transactions
  WHERE restaurant_id = p_restaurant_id
    AND type = 'purchase'
    AND created_at >= p_start_date 
    AND created_at <= p_end_date;
  
  -- Calculate points issued and redeemed
  SELECT 
    COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0)
  INTO total_points_issued, total_points_redeemed
  FROM transactions
  WHERE restaurant_id = p_restaurant_id
    AND created_at >= p_start_date 
    AND created_at <= p_end_date;
  
  -- Calculate reward cost using actual point value
  total_reward_cost := total_points_redeemed * point_value_aed;
  
  -- Estimate COGS and gross profit
  estimated_cogs := total_revenue * (1 - default_profit_margin);
  estimated_gross_profit := total_revenue - estimated_cogs;
  
  -- Calculate net profit after rewards
  net_profit_after_rewards := estimated_gross_profit - total_reward_cost;
  
  -- Calculate ROI percentage
  IF total_reward_cost > 0 THEN
    roi_percentage := (net_profit_after_rewards / total_reward_cost) * 100;
  ELSE
    roi_percentage := 0;
  END IF;
  
  -- Build comprehensive result
  result := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', EXTRACT(days FROM p_end_date - p_start_date)
    ),
    'revenue_metrics', jsonb_build_object(
      'total_revenue', total_revenue,
      'total_orders', total_orders,
      'average_order_value', CASE WHEN total_orders > 0 THEN total_revenue / total_orders ELSE 0 END,
      'revenue_per_customer', CASE WHEN total_customers > 0 THEN total_revenue / total_customers ELSE 0 END
    ),
    'cost_metrics', jsonb_build_object(
      'estimated_cogs', estimated_cogs,
      'estimated_gross_profit', estimated_gross_profit,
      'total_reward_cost', total_reward_cost,
      'reward_cost_percentage', CASE WHEN total_revenue > 0 THEN (total_reward_cost / total_revenue) * 100 ELSE 0 END
    ),
    'loyalty_metrics', jsonb_build_object(
      'total_points_issued', total_points_issued,
      'total_points_redeemed', total_points_redeemed,
      'point_redemption_rate', CASE WHEN total_points_issued > 0 THEN (total_points_redeemed::decimal / total_points_issued) * 100 ELSE 0 END,
      'point_value_aed', point_value_aed,
      'outstanding_liability', (total_points_issued - total_points_redeemed) * point_value_aed
    ),
    'customer_metrics', jsonb_build_object(
      'total_customers', total_customers,
      'returning_customers', returning_customers,
      'retention_rate', CASE WHEN total_customers > 0 THEN (returning_customers::decimal / total_customers) * 100 ELSE 0 END
    ),
    'profitability', jsonb_build_object(
      'gross_profit_margin', CASE WHEN total_revenue > 0 THEN (estimated_gross_profit / total_revenue) * 100 ELSE 0 END,
      'net_profit_after_rewards', net_profit_after_rewards,
      'net_profit_margin', CASE WHEN total_revenue > 0 THEN (net_profit_after_rewards / total_revenue) * 100 ELSE 0 END,
      'roi_percentage', roi_percentage,
      'roi_status', CASE 
        WHEN roi_percentage >= 200 THEN 'excellent'
        WHEN roi_percentage >= 100 THEN 'good'
        WHEN roi_percentage >= 0 THEN 'break_even'
        ELSE 'losing_money'
      END
    ),
    'settings_used', jsonb_build_object(
      'point_value_aed', point_value_aed,
      'default_profit_margin', default_profit_margin,
      'calculation_method', 'estimated_based_on_profit_margin'
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update restaurant ROI settings
CREATE OR REPLACE FUNCTION update_restaurant_roi_settings(
  p_restaurant_id UUID,
  p_roi_settings JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE restaurants 
  SET roi_settings = p_roi_settings
  WHERE id = p_restaurant_id AND owner_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found or access denied';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_comprehensive_roi TO authenticated;
GRANT EXECUTE ON FUNCTION update_restaurant_roi_settings TO authenticated;