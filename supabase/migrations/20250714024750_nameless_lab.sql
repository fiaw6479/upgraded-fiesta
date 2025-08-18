/*
  # Create menu items table with per-item loyalty settings

  1. New Tables
    - `menu_items`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text, optional)
      - `category` (text)
      - `cost_price` (decimal)
      - `selling_price` (decimal)
      - `loyalty_mode` (enum: smart, manual, none)
      - `loyalty_settings` (jsonb)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `menu_items` table
    - Add policies for restaurant owners to manage their menu items

  3. Functions
    - Add function to calculate points per menu item
    - Update existing point calculation to use menu item data
*/

CREATE TYPE loyalty_mode AS ENUM ('smart', 'manual', 'none');

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'main',
  cost_price decimal(10,2) NOT NULL DEFAULT 0,
  selling_price decimal(10,2) NOT NULL DEFAULT 0,
  loyalty_mode loyalty_mode NOT NULL DEFAULT 'none',
  loyalty_settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Policies for menu items
CREATE POLICY "Restaurant owners can manage menu items"
  ON menu_items
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = menu_items.restaurant_id 
    AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = menu_items.restaurant_id 
    AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Restaurant owners can view menu items"
  ON menu_items
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = menu_items.restaurant_id 
    AND r.owner_id = auth.uid()
  ));

-- Add updated_at trigger
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate points for a specific menu item
CREATE OR REPLACE FUNCTION calculate_points_for_menu_item(
  p_menu_item_id uuid,
  p_quantity integer DEFAULT 1,
  p_customer_tier text DEFAULT 'bronze'
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_menu_item menu_items%ROWTYPE;
  v_restaurant restaurants%ROWTYPE;
  v_base_points integer := 0;
  v_tier_multiplier decimal := 1.0;
  v_final_points integer := 0;
  v_profit decimal;
  v_reward_value decimal;
BEGIN
  -- Get menu item details
  SELECT * INTO v_menu_item
  FROM menu_items
  WHERE id = p_menu_item_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Get restaurant settings for tier multipliers
  SELECT * INTO v_restaurant
  FROM restaurants
  WHERE id = v_menu_item.restaurant_id;
  
  -- Calculate base points based on loyalty mode
  CASE v_menu_item.loyalty_mode
    WHEN 'smart' THEN
      -- Smart mode: profit-based calculation
      v_profit := (v_menu_item.selling_price - v_menu_item.cost_price) * p_quantity;
      v_reward_value := v_profit * COALESCE((v_menu_item.loyalty_settings->>'profit_allocation_percent')::decimal, 0) / 100;
      v_base_points := FLOOR(v_reward_value);
      
    WHEN 'manual' THEN
      -- Manual mode: fixed points per item
      v_base_points := COALESCE((v_menu_item.loyalty_settings->>'fixed_points')::integer, 0) * p_quantity;
      
    ELSE
      -- No loyalty rewards for this item
      v_base_points := 0;
  END CASE;
  
  -- Apply tier multiplier
  v_tier_multiplier := CASE p_customer_tier
    WHEN 'platinum' THEN COALESCE((v_restaurant.settings->'reward_engine'->'tier_multipliers'->>'platinum')::decimal, 2.0)
    WHEN 'gold' THEN COALESCE((v_restaurant.settings->'reward_engine'->'tier_multipliers'->>'gold')::decimal, 1.5)
    WHEN 'silver' THEN COALESCE((v_restaurant.settings->'reward_engine'->'tier_multipliers'->>'silver')::decimal, 1.25)
    ELSE COALESCE((v_restaurant.settings->'reward_engine'->'tier_multipliers'->>'bronze')::decimal, 1.0)
  END;
  
  v_final_points := FLOOR(v_base_points * v_tier_multiplier);
  
  -- Apply maximum points limit if set
  IF v_restaurant.settings->'reward_engine'->>'max_points_per_order' IS NOT NULL THEN
    v_final_points := LEAST(v_final_points, (v_restaurant.settings->'reward_engine'->>'max_points_per_order')::integer);
  END IF;
  
  RETURN GREATEST(v_final_points, 0);
END;
$$;