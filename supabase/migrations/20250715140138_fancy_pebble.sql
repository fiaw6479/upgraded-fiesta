/*
  # Create branches table and update transactions

  1. New Tables
    - `branches`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `name` (text)
      - `location` (text)
      - `staff_password` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes
    - Add `branch_id` column to `transactions` table
    - Add foreign key constraint for branch_id

  3. Security
    - Enable RLS on `branches` table
    - Add policies for restaurant owners to manage branches
    - Add index for better performance
*/

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text NOT NULL,
  staff_password text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add branch_id to transactions table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Create policies for branches
CREATE POLICY "Restaurant owners can manage branches"
  ON branches
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = branches.restaurant_id AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = branches.restaurant_id AND r.owner_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_branches_restaurant_id ON branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);

-- Create updated_at trigger for branches
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update process_point_transaction function to include branch_id
CREATE OR REPLACE FUNCTION process_point_transaction(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_type text,
  p_points integer,
  p_amount_spent numeric DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_reward_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert transaction record
  INSERT INTO transactions (
    restaurant_id,
    customer_id,
    branch_id,
    type,
    points,
    amount_spent,
    description,
    reward_id
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    p_branch_id,
    p_type,
    p_points,
    p_amount_spent,
    p_description,
    p_reward_id
  );

  -- Update customer points and stats
  UPDATE customers
  SET 
    total_points = total_points + p_points,
    lifetime_points = CASE 
      WHEN p_points > 0 THEN lifetime_points + p_points 
      ELSE lifetime_points 
    END,
    total_spent = total_spent + COALESCE(p_amount_spent, 0),
    visit_count = CASE 
      WHEN p_type = 'purchase' THEN visit_count + 1 
      ELSE visit_count 
    END,
    last_visit = CASE 
      WHEN p_type = 'purchase' THEN now() 
      ELSE last_visit 
    END,
    updated_at = now()
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
END;
$$;