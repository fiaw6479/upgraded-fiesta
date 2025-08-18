/*
  # Sample Data for Development

  1. Sample Rewards
    - Creates default rewards for restaurants
    - Different tiers and categories

  2. Sample Settings
    - Default restaurant settings
*/

-- Function to create sample rewards for a restaurant
CREATE OR REPLACE FUNCTION create_sample_rewards(p_restaurant_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO rewards (restaurant_id, name, description, points_required, category, min_tier) VALUES
    (p_restaurant_id, 'Free Appetizer', 'Choose any appetizer from our menu', 100, 'food', 'bronze'),
    (p_restaurant_id, 'Free Dessert', 'Complimentary dessert of your choice', 150, 'food', 'bronze'),
    (p_restaurant_id, 'Free Drink', 'Any beverage from our drink menu', 75, 'beverage', 'bronze'),
    (p_restaurant_id, '10% Off Next Visit', 'Get 10% discount on your next meal', 200, 'discount', 'bronze'),
    (p_restaurant_id, 'Free Main Course', 'Choose any main course from our menu', 300, 'food', 'silver'),
    (p_restaurant_id, '20% Off Next Visit', 'Get 20% discount on your next meal', 400, 'discount', 'silver'),
    (p_restaurant_id, 'VIP Table Reservation', 'Priority seating and VIP treatment', 500, 'experience', 'gold'),
    (p_restaurant_id, 'Chef''s Special Tasting', 'Exclusive tasting menu by our chef', 750, 'experience', 'gold');
END;
$$ LANGUAGE plpgsql;

-- Function to set default restaurant settings
CREATE OR REPLACE FUNCTION set_default_restaurant_settings(p_restaurant_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE restaurants 
  SET settings = jsonb_build_object(
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
  WHERE id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql;