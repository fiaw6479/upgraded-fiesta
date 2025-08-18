/*
  # Create Users Table and Fix Super Admin System

  1. New Tables
    - `users` table to store user authentication data and metadata
    - Proper foreign key relationships between restaurants and users

  2. Security
    - Enable RLS on users table
    - Add policies for user data access
    - Add super admin specific policies

  3. Functions
    - Add super admin utility functions
    - Add customer management functions for super admin
    - Add restaurant management functions

  4. Indexes
    - Add performance indexes for super admin queries
*/

-- Create users table to match Supabase auth.users structure
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  user_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_super_admin boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Super admin policies (bypass RLS for super admin operations)
CREATE POLICY "Super admin can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Function to sync auth.users with our users table
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, user_metadata, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data, '{}'),
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    user_metadata = COALESCE(NEW.raw_user_meta_data, '{}'),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Super admin function to get all restaurants with owner data
CREATE OR REPLACE FUNCTION get_all_restaurants_for_super_admin()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  owner_email text,
  owner_metadata jsonb,
  total_customers bigint,
  total_rewards bigint,
  total_revenue numeric,
  total_points_issued bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.slug,
    r.owner_id,
    r.settings,
    r.created_at,
    r.updated_at,
    u.email as owner_email,
    u.user_metadata as owner_metadata,
    COALESCE(customer_stats.total_customers, 0) as total_customers,
    COALESCE(reward_stats.total_rewards, 0) as total_rewards,
    COALESCE(customer_stats.total_revenue, 0) as total_revenue,
    COALESCE(transaction_stats.total_points_issued, 0) as total_points_issued
  FROM restaurants r
  LEFT JOIN users u ON r.owner_id = u.id
  LEFT JOIN (
    SELECT 
      restaurant_id,
      COUNT(*) as total_customers,
      SUM(total_spent) as total_revenue
    FROM customers
    GROUP BY restaurant_id
  ) customer_stats ON r.id = customer_stats.restaurant_id
  LEFT JOIN (
    SELECT 
      restaurant_id,
      COUNT(*) as total_rewards
    FROM rewards
    GROUP BY restaurant_id
  ) reward_stats ON r.id = reward_stats.restaurant_id
  LEFT JOIN (
    SELECT 
      restaurant_id,
      SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_points_issued
    FROM transactions
    GROUP BY restaurant_id
  ) transaction_stats ON r.id = transaction_stats.restaurant_id
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super admin function to get all customers across restaurants
CREATE OR REPLACE FUNCTION get_all_customers_for_super_admin()
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  total_points integer,
  lifetime_points integer,
  current_tier text,
  visit_count integer,
  total_spent numeric,
  created_at timestamptz,
  restaurant_name text,
  restaurant_slug text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.restaurant_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.total_points,
    c.lifetime_points,
    c.current_tier,
    c.visit_count,
    c.total_spent,
    c.created_at,
    r.name as restaurant_name,
    r.slug as restaurant_slug
  FROM customers c
  LEFT JOIN restaurants r ON c.restaurant_id = r.id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super admin function to adjust customer points
CREATE OR REPLACE FUNCTION super_admin_adjust_customer_points(
  p_customer_id uuid,
  p_points_adjustment integer,
  p_description text DEFAULT 'Super admin adjustment'
)
RETURNS void AS $$
DECLARE
  v_customer customers%ROWTYPE;
BEGIN
  -- Get customer details
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  
  -- Create transaction record
  INSERT INTO transactions (
    restaurant_id,
    customer_id,
    type,
    points,
    description,
    created_at
  ) VALUES (
    v_customer.restaurant_id,
    p_customer_id,
    CASE WHEN p_points_adjustment > 0 THEN 'bonus' ELSE 'redemption' END,
    p_points_adjustment,
    p_description,
    now()
  );
  
  -- Update customer points
  UPDATE customers 
  SET 
    total_points = GREATEST(0, total_points + p_points_adjustment),
    lifetime_points = CASE 
      WHEN p_points_adjustment > 0 THEN lifetime_points + p_points_adjustment 
      ELSE lifetime_points 
    END,
    updated_at = now()
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super admin function to reset customer data
CREATE OR REPLACE FUNCTION super_admin_reset_customer_data(p_restaurant_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
  IF p_restaurant_id IS NOT NULL THEN
    -- Reset specific restaurant's customer data
    DELETE FROM transactions WHERE restaurant_id = p_restaurant_id;
    DELETE FROM reward_redemptions WHERE restaurant_id = p_restaurant_id;
    UPDATE customers 
    SET 
      total_points = 0,
      lifetime_points = 0,
      current_tier = 'bronze',
      tier_progress = 0,
      visit_count = 0,
      total_spent = 0,
      last_visit = NULL
    WHERE restaurant_id = p_restaurant_id;
  ELSE
    -- Reset all customer data
    DELETE FROM transactions;
    DELETE FROM reward_redemptions;
    UPDATE customers 
    SET 
      total_points = 0,
      lifetime_points = 0,
      current_tier = 'bronze',
      tier_progress = 0,
      visit_count = 0,
      total_spent = 0,
      last_visit = NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super admin function to delete restaurant and all data
CREATE OR REPLACE FUNCTION super_admin_delete_restaurant(p_restaurant_id uuid)
RETURNS void AS $$
BEGIN
  -- Delete all related data (foreign keys will cascade)
  DELETE FROM restaurants WHERE id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super admin function to get system statistics
CREATE OR REPLACE FUNCTION get_system_statistics()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_restaurants', (SELECT COUNT(*) FROM restaurants),
    'total_customers', (SELECT COUNT(*) FROM customers),
    'total_revenue', (SELECT COALESCE(SUM(total_spent), 0) FROM customers),
    'total_points_issued', (SELECT COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) FROM transactions),
    'active_tickets', (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')),
    'monthly_growth', jsonb_build_object(
      'restaurants', (
        SELECT COUNT(*) FROM restaurants 
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      ),
      'customers', (
        SELECT COUNT(*) FROM customers 
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      ),
      'revenue', (
        SELECT COALESCE(SUM(total_spent), 0) FROM customers 
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for super admin performance
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_created ON customers(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_restaurant_created ON transactions(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_restaurant ON support_tickets(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin) WHERE is_super_admin = true;

-- Populate users table with existing auth users (if any)
INSERT INTO users (id, email, user_metadata, created_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data, '{}'),
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;