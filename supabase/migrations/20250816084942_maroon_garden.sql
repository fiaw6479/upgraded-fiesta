/*
  # Fix Support System Global Access

  1. Security Updates
    - Add is_super_admin() function for proper access control
    - Update support_tickets policies for global super admin access
    - Update support_messages policies for global super admin access
    - Ensure tickets are visible to super admin regardless of restaurant context

  2. Functions
    - Create is_super_admin() function to check super admin status
    - Update RLS policies to use this function

  3. Policy Updates
    - Super admin can view ALL tickets from ALL restaurants
    - Super admin can manage ALL messages from ALL tickets
    - Restaurant managers can only see their own tickets
*/

-- Create is_super_admin function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is a super admin
  -- This can be based on email, user metadata, or a dedicated super_admin table
  -- For now, we'll use a simple approach with specific emails or user metadata
  
  -- Method 1: Check if user has super admin metadata
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      raw_user_meta_data->>'is_super_admin' = 'true'
      OR email IN ('admin@voya.com', 'superadmin@voya.com')
    )
  ) THEN
    RETURN true;
  END IF;
  
  -- Method 2: Check users table for super admin flag
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND is_super_admin = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Drop existing policies for support_tickets
DROP POLICY IF EXISTS "Restaurant managers can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Restaurant managers can update own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Restaurant managers can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Service role can manage all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Super admin can update all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Super admin can view all tickets" ON support_tickets;

-- Create new comprehensive policies for support_tickets
CREATE POLICY "Restaurant managers can create tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = support_tickets.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant managers can view own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = support_tickets.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant managers can update own tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = support_tickets.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin can update all tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Service role can manage all tickets"
  ON support_tickets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop existing policies for support_messages
DROP POLICY IF EXISTS "Restaurant managers can create messages for own tickets" ON support_messages;
DROP POLICY IF EXISTS "Restaurant managers can view messages for own tickets" ON support_messages;
DROP POLICY IF EXISTS "Service role can manage all messages" ON support_messages;
DROP POLICY IF EXISTS "Super admin can create messages for any ticket" ON support_messages;
DROP POLICY IF EXISTS "Super admin can view all messages" ON support_messages;

-- Create new comprehensive policies for support_messages
CREATE POLICY "Restaurant managers can create messages for own tickets"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      JOIN restaurants r ON r.id = st.restaurant_id
      WHERE st.id = support_messages.ticket_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant managers can view messages for own tickets"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      JOIN restaurants r ON r.id = st.restaurant_id
      WHERE st.id = support_messages.ticket_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin can create messages for any ticket"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Service role can manage all messages"
  ON support_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update support_tickets to include restaurant information in queries
-- This helps with the join queries in the application