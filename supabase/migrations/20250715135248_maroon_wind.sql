/*
  # Create branches table for multi-branch restaurant management

  1. New Tables
    - `branches`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `name` (text, branch name)
      - `location` (text, branch location/address)
      - `staff_password` (text, password for staff access)
      - `is_active` (boolean, whether branch is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `branches` table
    - Add policies for restaurant owners to manage their branches

  3. Updates
    - Add `branch_id` column to `transactions` table to track branch-specific transactions
*/

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  staff_password text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Create policies for branches
CREATE POLICY "Restaurant owners can manage branches"
  ON branches
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = branches.restaurant_id 
    AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = branches.restaurant_id 
    AND r.owner_id = auth.uid()
  ));

-- Add branch_id to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create updated_at trigger for branches
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_branches_restaurant_id ON branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);