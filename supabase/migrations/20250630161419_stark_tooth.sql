/*
  # Multi-Tenant Restaurant Loyalty System Schema

  1. New Tables
    - `restaurants`
      - `id` (uuid, primary key)
      - `name` (text, restaurant name)
      - `owner_id` (uuid, references auth.users)
      - `slug` (text, unique identifier for restaurant)
      - `settings` (jsonb, restaurant-specific settings)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `restaurant_staff`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `user_id` (uuid, references auth.users)
      - `role` (text, staff role)
      - `created_at` (timestamp)
    
    - `customers`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `first_name` (text)
      - `last_name` (text)
      - `email` (text)
      - `phone` (text, optional)
      - `date_of_birth` (date, optional)
      - `total_points` (integer, default 0)
      - `lifetime_points` (integer, default 0)
      - `current_tier` (text, default 'bronze')
      - `tier_progress` (integer, default 0)
      - `visit_count` (integer, default 0)
      - `total_spent` (decimal, default 0)
      - `last_visit` (timestamp, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `rewards`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `name` (text)
      - `description` (text, optional)
      - `points_required` (integer)
      - `category` (text)
      - `image_url` (text, optional)
      - `min_tier` (text, default 'bronze')
      - `is_active` (boolean, default true)
      - `total_available` (integer, optional)
      - `total_redeemed` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `transactions`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `customer_id` (uuid, references customers)
      - `type` (text, 'purchase' | 'bonus' | 'referral' | 'signup' | 'redemption')
      - `points` (integer)
      - `amount_spent` (decimal, optional)
      - `description` (text, optional)
      - `reward_id` (uuid, optional, references rewards)
      - `created_at` (timestamp)
    
    - `reward_redemptions`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `customer_id` (uuid, references customers)
      - `reward_id` (uuid, references rewards)
      - `points_used` (integer)
      - `status` (text, default 'pending')
      - `redeemed_at` (timestamp)
      - `used_at` (timestamp, optional)

  2. Security
    - Enable RLS on all tables
    - Add policies for restaurant-specific data access
    - Ensure users can only access their restaurant's data

  3. Functions
    - Function to create restaurant profile on user signup
    - Function to calculate tier progress
    - Function to handle point transactions
*/

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create restaurant_staff table
CREATE TABLE IF NOT EXISTS restaurant_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  date_of_birth date,
  total_points integer DEFAULT 0,
  lifetime_points integer DEFAULT 0,
  current_tier text DEFAULT 'bronze' CHECK (current_tier IN ('bronze', 'silver', 'gold')),
  tier_progress integer DEFAULT 0,
  visit_count integer DEFAULT 0,
  total_spent decimal(10,2) DEFAULT 0,
  last_visit timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, email)
);

-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  category text NOT NULL,
  image_url text,
  min_tier text DEFAULT 'bronze' CHECK (min_tier IN ('bronze', 'silver', 'gold')),
  is_active boolean DEFAULT true,
  total_available integer,
  total_redeemed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'bonus', 'referral', 'signup', 'redemption')),
  points integer NOT NULL,
  amount_spent decimal(10,2),
  description text,
  reward_id uuid REFERENCES rewards(id),
  created_at timestamptz DEFAULT now()
);

-- Create reward_redemptions table
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES rewards(id) ON DELETE CASCADE,
  points_used integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  redeemed_at timestamptz DEFAULT now(),
  used_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurants
CREATE POLICY "Users can view their own restaurant"
  ON restaurants FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR id IN (
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own restaurant"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own restaurant"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- RLS Policies for restaurant_staff
CREATE POLICY "Staff can view their restaurant staff"
  ON restaurant_staff FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owners can manage restaurant staff"
  ON restaurant_staff FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ));

-- RLS Policies for customers
CREATE POLICY "Restaurant users can view their customers"
  ON customers FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their customers"
  ON customers FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for rewards
CREATE POLICY "Restaurant users can view their rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their rewards"
  ON rewards FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for transactions
CREATE POLICY "Restaurant users can view their transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their transactions"
  ON transactions FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for reward_redemptions
CREATE POLICY "Restaurant users can view their redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their redemptions"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate tier based on lifetime points
CREATE OR REPLACE FUNCTION calculate_tier(lifetime_points integer)
RETURNS text AS $$
BEGIN
  IF lifetime_points >= 1000 THEN
    RETURN 'gold';
  ELSIF lifetime_points >= 500 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate tier progress
CREATE OR REPLACE FUNCTION calculate_tier_progress(lifetime_points integer)
RETURNS integer AS $$
BEGIN
  IF lifetime_points >= 1000 THEN
    RETURN 100; -- Gold tier, no further progress
  ELSIF lifetime_points >= 500 THEN
    RETURN ((lifetime_points - 500) * 100 / 500); -- Progress to gold
  ELSE
    RETURN (lifetime_points * 100 / 500); -- Progress to silver
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update customer tier and progress
CREATE OR REPLACE FUNCTION update_customer_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.current_tier = calculate_tier(NEW.lifetime_points);
  NEW.tier_progress = calculate_tier_progress(NEW.lifetime_points);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update tier when lifetime_points changes
CREATE TRIGGER update_customer_tier_trigger
  BEFORE UPDATE OF lifetime_points ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_tier();

-- Function to handle point transactions
CREATE OR REPLACE FUNCTION process_point_transaction(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_type text,
  p_points integer,
  p_amount_spent decimal DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_reward_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  transaction_id uuid;
BEGIN
  -- Insert transaction
  INSERT INTO transactions (
    restaurant_id, customer_id, type, points, amount_spent, description, reward_id
  ) VALUES (
    p_restaurant_id, p_customer_id, p_type, p_points, p_amount_spent, p_description, p_reward_id
  ) RETURNING id INTO transaction_id;
  
  -- Update customer points
  IF p_type = 'redemption' THEN
    -- Subtract points for redemption
    UPDATE customers 
    SET total_points = total_points - ABS(p_points),
        updated_at = now()
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  ELSE
    -- Add points for other transactions
    UPDATE customers 
    SET total_points = total_points + p_points,
        lifetime_points = lifetime_points + p_points,
        updated_at = now()
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  END IF;
  
  -- Update visit count for purchases
  IF p_type = 'purchase' THEN
    UPDATE customers 
    SET visit_count = visit_count + 1,
        total_spent = total_spent + COALESCE(p_amount_spent, 0),
        last_visit = now(),
        updated_at = now()
    WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  END IF;
  
  RETURN transaction_id;
END;
$$ LANGUAGE plpgsql;