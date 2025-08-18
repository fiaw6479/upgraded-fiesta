/*
  # Fix infinite recursion in RLS policies

  1. Policy Updates
    - Fix restaurants table policies to use auth.uid() instead of uid()
    - Fix restaurant_staff table policies to use auth.uid() instead of uid()
    - Fix customers table policies to use auth.uid() instead of uid()
    - Fix rewards table policies to use auth.uid() instead of uid()
    - Fix transactions table policies to use auth.uid() instead of uid()
    - Fix reward_redemptions table policies to use auth.uid() instead of uid()

  2. Security
    - Maintain existing RLS protection
    - Ensure proper user isolation
*/

-- Drop existing policies and recreate with correct auth.uid() references

-- Restaurants table policies
DROP POLICY IF EXISTS "Restaurant owners and staff can view restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can insert their own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Users can update their own restaurant" ON restaurants;

CREATE POLICY "Restaurant owners and staff can view restaurants"
  ON restaurants
  FOR SELECT
  TO authenticated
  USING ((owner_id = auth.uid()) OR (id IN ( 
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  )));

CREATE POLICY "Users can insert their own restaurant"
  ON restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own restaurant"
  ON restaurants
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Restaurant staff table policies
DROP POLICY IF EXISTS "Owners can manage restaurant staff" ON restaurant_staff;
DROP POLICY IF EXISTS "Staff can view their restaurant staff" ON restaurant_staff;

CREATE POLICY "Owners can manage restaurant staff"
  ON restaurant_staff
  FOR ALL
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
  ));

CREATE POLICY "Staff can view their restaurant staff"
  ON restaurant_staff
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff_1.restaurant_id
    FROM restaurant_staff restaurant_staff_1
    WHERE (restaurant_staff_1.user_id = auth.uid())
  ));

-- Customers table policies
DROP POLICY IF EXISTS "Restaurant users can manage their customers" ON customers;
DROP POLICY IF EXISTS "Restaurant users can view their customers" ON customers;

CREATE POLICY "Restaurant users can manage their customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));

CREATE POLICY "Restaurant users can view their customers"
  ON customers
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));

-- Rewards table policies
DROP POLICY IF EXISTS "Restaurant users can manage their rewards" ON rewards;
DROP POLICY IF EXISTS "Restaurant users can view their rewards" ON rewards;

CREATE POLICY "Restaurant users can manage their rewards"
  ON rewards
  FOR ALL
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));

CREATE POLICY "Restaurant users can view their rewards"
  ON rewards
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));

-- Transactions table policies
DROP POLICY IF EXISTS "Restaurant users can manage their transactions" ON transactions;
DROP POLICY IF EXISTS "Restaurant users can view their transactions" ON transactions;

CREATE POLICY "Restaurant users can manage their transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));

CREATE POLICY "Restaurant users can view their transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));

-- Reward redemptions table policies
DROP POLICY IF EXISTS "Restaurant users can manage their redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Restaurant users can view their redemptions" ON reward_redemptions;

CREATE POLICY "Restaurant users can manage their redemptions"
  ON reward_redemptions
  FOR ALL
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));

CREATE POLICY "Restaurant users can view their redemptions"
  ON reward_redemptions
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN ( 
    SELECT restaurants.id
    FROM restaurants
    WHERE (restaurants.owner_id = auth.uid())
    UNION
    SELECT restaurant_staff.restaurant_id
    FROM restaurant_staff
    WHERE (restaurant_staff.user_id = auth.uid())
  ));