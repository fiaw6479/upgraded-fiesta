/*
  # Fix infinite loading and RLS policy issues

  1. Drop all problematic RLS policies
  2. Create simplified, non-recursive policies
  3. Fix authentication trigger issues
  4. Ensure proper restaurant creation

  This migration completely resolves the infinite recursion and loading issues.
*/

-- First, drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Restaurant owners and staff can view restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can insert their own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Users can update their own restaurant" ON restaurants;

DROP POLICY IF EXISTS "Owners can manage restaurant staff" ON restaurant_staff;
DROP POLICY IF EXISTS "Staff can view their restaurant staff" ON restaurant_staff;

DROP POLICY IF EXISTS "Restaurant users can manage their customers" ON customers;
DROP POLICY IF EXISTS "Restaurant users can view their customers" ON customers;

DROP POLICY IF EXISTS "Restaurant users can manage their rewards" ON rewards;
DROP POLICY IF EXISTS "Restaurant users can view their rewards" ON rewards;

DROP POLICY IF EXISTS "Restaurant users can manage their transactions" ON transactions;
DROP POLICY IF EXISTS "Restaurant users can view their transactions" ON transactions;

DROP POLICY IF EXISTS "Restaurant users can manage their redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Restaurant users can view their redemptions" ON reward_redemptions;

-- Create simple, non-recursive policies for restaurants table
CREATE POLICY "Users can view own restaurants"
  ON restaurants FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own restaurants"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own restaurants"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Create simple policies for restaurant_staff
CREATE POLICY "View restaurant staff"
  ON restaurant_staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = restaurant_staff.restaurant_id 
      AND r.owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Manage restaurant staff"
  ON restaurant_staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = restaurant_staff.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- Create simple policies for customers
CREATE POLICY "View customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = customers.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = customers.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- Create simple policies for rewards
CREATE POLICY "View rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = rewards.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Manage rewards"
  ON rewards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = rewards.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- Create simple policies for transactions
CREATE POLICY "View transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = transactions.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Manage transactions"
  ON transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = transactions.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- Create simple policies for reward_redemptions
CREATE POLICY "View redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = reward_redemptions.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Manage redemptions"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = reward_redemptions.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- Drop the problematic trigger that might be causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_id uuid;
  restaurant_slug text;
  restaurant_name text;
BEGIN
  -- Only proceed if this is a new user with metadata
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'restaurant_name' THEN
    -- Get restaurant name from metadata
    restaurant_name := COALESCE(
      NEW.raw_user_meta_data->>'restaurant_name',
      'My Restaurant'
    );
    
    -- Generate restaurant slug
    restaurant_slug := lower(regexp_replace(restaurant_name, '[^a-zA-Z0-9]+', '-', 'g'));
    restaurant_slug := trim(both '-' from restaurant_slug);
    restaurant_slug := restaurant_slug || '-' || extract(epoch from now())::text;
    
    -- Insert restaurant record with error handling
    BEGIN
      INSERT INTO public.restaurants (
        name,
        owner_id,
        slug,
        settings
      ) VALUES (
        restaurant_name,
        NEW.id,
        restaurant_slug,
        jsonb_build_object(
          'points_per_dollar', 1,
          'signup_bonus', 100,
          'referral_bonus', 50,
          'tier_thresholds', jsonb_build_object(
            'silver', 500,
            'gold', 1000
          ),
          'loyalty_program', jsonb_build_object(
            'name', 'Loyalty Program',
            'description', 'Earn points with every purchase and redeem for rewards!'
          )
        )
      ) RETURNING id INTO restaurant_id;
      
      -- Create sample rewards with error handling
      BEGIN
        INSERT INTO public.rewards (restaurant_id, name, description, points_required, category, min_tier) VALUES
          (restaurant_id, 'Free Appetizer', 'Choose any appetizer from our menu', 100, 'food', 'bronze'),
          (restaurant_id, 'Free Dessert', 'Complimentary dessert of your choice', 150, 'food', 'bronze'),
          (restaurant_id, 'Free Drink', 'Any beverage from our drink menu', 75, 'beverage', 'bronze'),
          (restaurant_id, '10% Off Next Visit', 'Get 10% discount on your next meal', 200, 'discount', 'bronze'),
          (restaurant_id, 'Free Main Course', 'Choose any main course from our menu', 300, 'food', 'silver'),
          (restaurant_id, '20% Off Next Visit', 'Get 20% discount on your next meal', 400, 'discount', 'silver'),
          (restaurant_id, 'VIP Table Reservation', 'Priority seating and VIP treatment', 500, 'experience', 'gold'),
          (restaurant_id, 'Chef''s Special Tasting', 'Exclusive tasting menu by our chef', 750, 'experience', 'gold');
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the user creation
        RAISE WARNING 'Failed to create sample rewards for restaurant %: %', restaurant_id, SQLERRM;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the user creation
      RAISE WARNING 'Failed to create restaurant for user %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();