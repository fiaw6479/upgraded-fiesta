/*
  # Fix Support System Policies

  1. Security Updates
    - Update support ticket policies to allow super admin access
    - Update support message policies for cross-restaurant visibility
    - Ensure proper RLS for super admin functionality

  2. Policy Changes
    - Allow super admin to view all tickets regardless of restaurant
    - Allow super admin to send messages to any ticket
    - Maintain restaurant manager access to their own tickets
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Restaurant managers can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Restaurant managers can update own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Restaurant managers can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create messages for accessible tickets" ON support_messages;
DROP POLICY IF EXISTS "Users can view messages for accessible tickets" ON support_messages;

-- Create new policies for support tickets
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

-- Allow service role (super admin) to access all tickets
CREATE POLICY "Service role can manage all tickets"
  ON support_tickets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create new policies for support messages
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

-- Allow service role (super admin) to access all messages
CREATE POLICY "Service role can manage all messages"
  ON support_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to handle super admin access
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is marked as super admin
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND is_super_admin = true
  );
END;
$$;

-- Add policies for super admin users
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

CREATE POLICY "Super admin can view all messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin can create messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());