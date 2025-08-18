/*
  # Auto-create restaurant on user signup

  1. New Function
    - `handle_new_user()` - Creates restaurant and sample data when user signs up
    
  2. New Trigger
    - Triggers on INSERT to auth.users table
    - Automatically creates restaurant profile with sample rewards and settings
    
  3. Security
    - Function runs with security definer privileges
    - Ensures every new user gets a restaurant automatically
*/

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_id uuid;
  restaurant_slug text;
BEGIN
  -- Only proceed if this is a new user with metadata
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    -- Generate restaurant slug from restaurant name
    restaurant_slug := COALESCE(
      NEW.raw_user_meta_data->>'restaurant_name',
      CONCAT(NEW.raw_user_meta_data->>'first_name', '-restaurant')
    );
    
    -- Clean up the slug
    restaurant_slug := lower(regexp_replace(restaurant_slug, '[^a-zA-Z0-9]+', '-', 'g'));
    restaurant_slug := trim(both '-' from restaurant_slug);
    
    -- Add timestamp to ensure uniqueness
    restaurant_slug := restaurant_slug || '-' || extract(epoch from now())::text;
    
    -- Insert restaurant record
    INSERT INTO public.restaurants (
      name,
      owner_id,
      slug,
      settings
    ) VALUES (
      COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'),
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
    
    -- Create sample rewards for the new restaurant
    INSERT INTO public.rewards (restaurant_id, name, description, points_required, category, min_tier) VALUES
      (restaurant_id, 'Free Appetizer', 'Choose any appetizer from our menu', 100, 'food', 'bronze'),
      (restaurant_id, 'Free Dessert', 'Complimentary dessert of your choice', 150, 'food', 'bronze'),
      (restaurant_id, 'Free Drink', 'Any beverage from our drink menu', 75, 'beverage', 'bronze'),
      (restaurant_id, '10% Off Next Visit', 'Get 10% discount on your next meal', 200, 'discount', 'bronze'),
      (restaurant_id, 'Free Main Course', 'Choose any main course from our menu', 300, 'food', 'silver'),
      (restaurant_id, '20% Off Next Visit', 'Get 20% discount on your next meal', 400, 'discount', 'silver'),
      (restaurant_id, 'VIP Table Reservation', 'Priority seating and VIP treatment', 500, 'experience', 'gold'),
      (restaurant_id, 'Chef''s Special Tasting', 'Exclusive tasting menu by our chef', 750, 'experience', 'gold');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;