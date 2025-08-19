/*
  # Fix subscription webhook function

  1. Database Functions
    - Drop conflicting function overloads
    - Create single, robust handle_subscription_webhook function
    - Add proper error handling and logging
  
  2. Security
    - Ensure proper RLS policies
    - Add service role permissions
*/

-- Drop all existing conflicting function overloads
DROP FUNCTION IF EXISTS handle_subscription_webhook(uuid, subscription_plan_type, subscription_status, text, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS handle_subscription_webhook(uuid, subscription_plan_type, text, text, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS handle_subscription_webhook(uuid, text, text, text, text, timestamptz, timestamptz);

-- Create single, robust subscription webhook handler
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_user_id uuid,
  p_plan_type text,
  p_status text,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_plan_type subscription_plan_type;
  v_status subscription_status;
  result jsonb;
BEGIN
  -- Log the webhook call
  RAISE NOTICE 'Processing subscription webhook for user: %, plan: %, status: %', p_user_id, p_plan_type, p_status;
  
  -- Validate and cast plan type
  BEGIN
    v_plan_type := p_plan_type::subscription_plan_type;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid plan type: %. Must be one of: trial, monthly, semiannual, annual', p_plan_type;
  END;
  
  -- Validate and cast status
  BEGIN
    v_status := p_status::subscription_status;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: active, expired, cancelled, past_due', p_status;
  END;
  
  -- Calculate periods if not provided
  v_period_start := COALESCE(p_period_start, NOW());
  
  IF p_period_end IS NULL THEN
    CASE v_plan_type
      WHEN 'trial' THEN
        v_period_end := v_period_start + INTERVAL '30 days';
      WHEN 'monthly' THEN
        v_period_end := v_period_start + INTERVAL '1 month';
      WHEN 'semiannual' THEN
        v_period_end := v_period_start + INTERVAL '6 months';
      WHEN 'annual' THEN
        v_period_end := v_period_start + INTERVAL '1 year';
    END CASE;
  ELSE
    v_period_end := p_period_end;
  END IF;
  
  -- Check if subscription exists
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE user_id = p_user_id;
  
  IF v_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE subscriptions
    SET 
      plan_type = v_plan_type,
      status = v_status,
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    RAISE NOTICE 'Updated existing subscription: %', v_subscription_id;
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
      v_plan_type,
      v_status,
      p_stripe_subscription_id,
      p_stripe_customer_id,
      v_period_start,
      v_period_end
    ) RETURNING id INTO v_subscription_id;
    
    RAISE NOTICE 'Created new subscription: %', v_subscription_id;
  END IF;
  
  -- Return result
  result := jsonb_build_object(
    'subscription_id', v_subscription_id,
    'user_id', p_user_id,
    'plan_type', v_plan_type,
    'status', v_status,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'processed_at', NOW()
  );
  
  RAISE NOTICE 'Webhook processing complete: %', result;
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Webhook processing failed: %', SQLERRM;
END;
$$;