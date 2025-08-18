/*
  # Fix infinite recursion in restaurants RLS policy

  1. Policy Changes
    - Drop existing problematic SELECT policy on restaurants table
    - Create simplified SELECT policy that avoids circular references
    - Keep INSERT and UPDATE policies as they work correctly

  2. Security
    - Owners can view their own restaurants (direct owner_id check)
    - Staff can view restaurants they're assigned to (via restaurant_staff table)
    - No circular references in policy definitions
*/

-- Drop the existing problematic SELECT policy
DROP POLICY IF EXISTS "Users can view their own restaurant" ON restaurants;

-- Create a new simplified SELECT policy that avoids circular references
CREATE POLICY "Restaurant owners and staff can view restaurants"
  ON restaurants
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() 
    OR 
    id IN (
      SELECT restaurant_id 
      FROM restaurant_staff 
      WHERE user_id = auth.uid()
    )
  );