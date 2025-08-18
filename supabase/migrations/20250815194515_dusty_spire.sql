/*
  # Fix Support System Global Access

  1. Security Updates
    - Update RLS policies to allow super admin global access
    - Ensure support tickets are visible across all restaurants for super admin
    - Fix message visibility for cross-restaurant support

  2. Functions
    - Add is_super_admin function for proper access control
    - Update support policies to use proper authentication

  3. Performance
    - Add indexes for better support ticket queries
    - Optimize message retrieval
*/

-- Create or replace the is_super_admin function
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

-- Update support tickets policies for global super admin access
DROP POLICY IF EXISTS "Super admin can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Super admin can update all tickets" ON support_tickets;

CREATE POLICY "Super admin can view all tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin can update all tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Update support messages policies for global super admin access
DROP POLICY IF EXISTS "Super admin can view all messages" ON support_messages;
DROP POLICY IF EXISTS "Super admin can create messages" ON support_messages;

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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at 
  ON support_tickets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created 
  ON support_messages(ticket_id, created_at);

-- Ensure super admin user exists (for demo purposes)
DO $$
BEGIN
  -- Insert super admin user if it doesn't exist
  INSERT INTO users (id, email, is_super_admin, user_metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'superadmin@voya.com',
    true,
    '{"role": "super_admin", "name": "Super Admin"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    is_super_admin = true,
    user_metadata = '{"role": "super_admin", "name": "Super Admin"}'::jsonb;
END $$;