/*
  # Add function to get user emails from auth.users

  1. New Functions
    - `get_user_emails` - Safely retrieves user emails from auth.users table
  
  2. Security
    - Function uses security definer to access auth schema
    - Only returns id and email fields for privacy
*/

-- Create function to get user emails from auth.users
CREATE OR REPLACE FUNCTION get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;