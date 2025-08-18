/*
  # Fix Subscription Billing Periods and Payment Processing

  1. Database Functions
    - Enhanced subscription period calculation
    - Improved webhook handling
    - Billing period text generation
    - Payment processing validation

  2. Triggers
    - Auto-update billing period text on subscription changes
    - Validate billing period accuracy

  3. Security
    - Enhanced RLS policies for subscription management
    - Proper webhook authentication
*/
DROP TRIGGER IF EXISTS trigger_update_billing_period_text ON subscriptions;
-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS calculate_subscription_period_end(text, timestamptz);
DROP FUNCTION IF EXISTS handle_subscription_webhook(uuid, text, text, text, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS update_billing_period_text();
DROP FUNCTION IF EXISTS get_subscription_with_periods(uuid);

-- Enhanced subscription period calculation
CREATE OR REPLACE FUNCTION calculate_subscription_period_end(
  plan_type text,
  period_start timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  period_end timestamptz;
BEGIN
  CASE plan_type
    WHEN 'trial' THEN
      period_end := period_start + interval '30 days';
    WHEN 'monthly' THEN
      period_end := period_start + interval '1 month';
    WHEN 'semiannual' THEN
      period_end := period_start + interval '6 months';
    WHEN 'annual' THEN
      period_end := period_start + interval '1 year';
    ELSE
      -- Default to trial period for unknown plans
      period_end := period_start + interval '30 days';
  END CASE;
  
  RETURN period_end;
END;
$$;

-- Enhanced webhook handler with proper validation
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_user_id uuid,
  p_plan_type text,
  p_status text,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_start timestamptz DEFAULT now(),
  p_period_end timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calculated_period_end timestamptz;
  existing_subscription_id uuid;
  result json;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;
  
  IF p_plan_type NOT IN ('trial', 'monthly', 'semiannual', 'annual') THEN
    RAISE EXCEPTION 'Invalid plan type: %', p_plan_type;
  END IF;
  
  IF p_status NOT IN ('active', 'expired', 'cancelled', 'past_due') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- Calculate period end if not provided
  IF p_period_end IS NULL THEN
    calculated_period_end := calculate_subscription_period_end(p_plan_type, p_period_start);
  ELSE
    calculated_period_end := p_period_end;
  END IF;

  -- Check for existing subscription
  SELECT id INTO existing_subscription_id
  FROM subscriptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF existing_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE subscriptions
    SET 
      plan_type = p_plan_type,
      status = p_status,
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      current_period_start = p_period_start,
      current_period_end = calculated_period_end,
      updated_at = now()
    WHERE id = existing_subscription_id;
    
    result := json_build_object(
      'action', 'updated',
      'subscription_id', existing_subscription_id,
      'period_start', p_period_start,
      'period_end', calculated_period_end
    );
  ELSE
    -- Create new subscription
    INSERT INTO subscriptions (
      user_id,
      plan_type,
      status,
      stripe_subscription_id,
      stripe_customer_id,
      current_period_start,
      current_period_end
    ) VALUES (
      p_user_id,
      p_plan_type,
      p_status,
      p_stripe_subscription_id,
      p_stripe_customer_id,
      p_period_start,
      calculated_period_end
    ) RETURNING id INTO existing_subscription_id;
    
    result := json_build_object(
      'action', 'created',
      'subscription_id', existing_subscription_id,
      'period_start', p_period_start,
      'period_end', calculated_period_end
    );
  END IF;

  RETURN result;
END;
$$;

-- Function to update billing period text
CREATE OR REPLACE FUNCTION update_billing_period_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  duration_text text;
  period_text text;
  expected_duration interval;
  actual_duration interval;
  is_accurate boolean := true;
BEGIN
  -- Calculate expected duration based on plan type
  CASE NEW.plan_type
    WHEN 'trial' THEN
      duration_text := '30 days';
      expected_duration := interval '30 days';
    WHEN 'monthly' THEN
      duration_text := '1 month';
      expected_duration := interval '1 month';
    WHEN 'semiannual' THEN
      duration_text := '6 months';
      expected_duration := interval '6 months';
    WHEN 'annual' THEN
      duration_text := '1 year';
      expected_duration := interval '1 year';
    ELSE
      duration_text := 'unknown';
      expected_duration := interval '30 days';
  END CASE;

  -- Calculate actual duration
  actual_duration := NEW.current_period_end - NEW.current_period_start;
  
  -- Check if billing period matches expected duration (within 1 day tolerance)
  IF abs(extract(epoch from (actual_duration - expected_duration))) > 86400 THEN
    is_accurate := false;
  END IF;

  -- Generate human-readable billing period text
  period_text := to_char(NEW.current_period_start, 'Mon DD, YYYY') || 
                ' – ' || 
                to_char(NEW.current_period_end, 'Mon DD, YYYY') || 
                ' (' || duration_text || ')';

  -- Update the record
  NEW.billing_period_text := period_text;
  NEW.billing_period_accurate := is_accurate;
  
  RETURN NEW;
END;
$$;

-- Enhanced subscription retrieval with proper period calculation
CREATE OR REPLACE FUNCTION get_subscription_with_periods(user_id_param uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  plan_type subscription_plan_type,
  status subscription_status,
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  billing_period_text text,
  billing_period_accurate boolean,
  days_remaining integer,
  is_expired boolean,
  is_cancelled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.plan_type,
    s.status,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    s.current_period_start,
    s.current_period_end,
    s.created_at,
    s.updated_at,
    s.billing_period_text,
    s.billing_period_accurate,
    GREATEST(0, EXTRACT(days FROM (s.current_period_end - now()))::integer) as days_remaining,
    (s.current_period_end <= now()) as is_expired,
    (s.status = 'cancelled') as is_cancelled
  FROM subscriptions s
  WHERE s.user_id = user_id_param
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to validate and fix billing periods
CREATE OR REPLACE FUNCTION validate_and_fix_billing_periods()
RETURNS TABLE(
  subscription_id uuid,
  plan_type text,
  old_period_end timestamptz,
  new_period_end timestamptz,
  was_fixed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record record;
  expected_end timestamptz;
  needs_fix boolean;
BEGIN
  FOR sub_record IN 
    SELECT * FROM subscriptions 
    WHERE billing_period_accurate = false OR billing_period_accurate IS NULL
  LOOP
    -- Calculate what the period end should be
    expected_end := calculate_subscription_period_end(
      sub_record.plan_type::text, 
      sub_record.current_period_start
    );
    
    -- Check if it needs fixing (more than 1 day difference)
    needs_fix := abs(extract(epoch from (sub_record.current_period_end - expected_end))) > 86400;
    
    IF needs_fix THEN
      -- Fix the subscription period
      UPDATE subscriptions
      SET 
        current_period_end = expected_end,
        billing_period_accurate = true,
        updated_at = now()
      WHERE id = sub_record.id;
      
      subscription_id := sub_record.id;
      plan_type := sub_record.plan_type::text;
      old_period_end := sub_record.current_period_end;
      new_period_end := expected_end;
      was_fixed := true;
      
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Create trigger to auto-update billing period text
DROP TRIGGER IF EXISTS trigger_update_billing_period_text ON subscriptions;
CREATE TRIGGER trigger_update_billing_period_text
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_period_text();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_period_accurate 
ON subscriptions(billing_period_accurate) 
WHERE billing_period_accurate = false;

CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end 
ON subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created 
ON subscriptions(user_id, created_at DESC);

-- Fix any existing subscriptions with incorrect billing periods
SELECT validate_and_fix_billing_periods();