/*
  # Support System for Restaurant Manager and Super Admin

  1. New Tables
    - `support_tickets`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `title` (text)
      - `description` (text)
      - `status` (enum: open, in_progress, resolved, closed)
      - `priority` (enum: low, medium, high, urgent)
      - `category` (text)
      - `created_by_user_id` (uuid)
      - `assigned_to_admin` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `support_messages`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to support_tickets)
      - `sender_type` (enum: restaurant_manager, super_admin)
      - `sender_id` (text)
      - `message` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for restaurant managers and super admins
*/

-- Create enums
CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE support_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE sender_type AS ENUM ('restaurant_manager', 'super_admin');

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status support_status DEFAULT 'open',
  priority support_priority DEFAULT 'medium',
  category text DEFAULT 'general',
  created_by_user_id uuid NOT NULL,
  assigned_to_admin text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create support_messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type sender_type NOT NULL,
  sender_id text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Policies for support_tickets
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

-- Policies for support_messages
CREATE POLICY "Users can view messages for accessible tickets"
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

CREATE POLICY "Users can create messages for accessible tickets"
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

-- Add updated_at trigger for support_tickets
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();