import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PaymentRequest {
  planType: 'monthly' | 'semiannual' | 'annual';
  autoRenew: boolean;
  paymentMethodId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { planType, autoRenew, paymentMethodId }: PaymentRequest = await req.json();

    console.log('💳 Creating payment:', {
      userId: user.id,
      planType,
      autoRenew,
      paymentMethodId: paymentMethodId.substring(0, 10) + '...'
    });

    // Define price mapping and amounts
    const priceMap = {
      monthly: Deno.env.get('STRIPE_MONTHLY_PRICE_ID'),
      semiannual: Deno.env.get('STRIPE_SEMIANNUAL_PRICE_ID'), 
      annual: Deno.env.get('STRIPE_ANNUAL_PRICE_ID')
    };

    const amounts = {
      monthly: 299, // $2.99 in cents
      semiannual: 999, // $9.99 in cents
      annual: 1999 // $19.99 in cents
    };

    // Validate price configuration
    const priceId = priceMap[planType];
    if (!priceId) {
      throw new Error(`Price ID not configured for plan: ${planType}. Please configure Stripe price IDs in environment variables.`);
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;

    const { data: existingSubscription } = await supabaseClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSubscription?.stripe_customer_id) {
      stripeCustomerId = existingSubscription.stripe_customer_id;
      console.log('👤 Using existing Stripe customer:', stripeCustomerId);
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;
      console.log('👤 Created new Stripe customer:', stripeCustomerId);
    }

    if (autoRenew) {
      console.log('🔄 Creating recurring subscription...');
      
      // Create subscription with proper metadata
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card']
        },
        default_payment_method: paymentMethodId,
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          user_id: user.id,
          plan_type: planType,
          auto_renew: 'true'
        },
      });

      console.log('📋 Subscription created:', {
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      return new Response(
        JSON.stringify({ 
          clientSecret: paymentIntent.client_secret,
          subscriptionId: subscription.id,
          customerId: stripeCustomerId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      console.log('💰 Creating one-time payment...');
      
      // Create one-time payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amounts[planType],
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        return_url: `${req.headers.get('origin') || 'http://localhost:5173'}/dashboard?payment=success`,
        metadata: {
          user_id: user.id,
          plan_type: planType,
          auto_renew: 'false'
        },
      });

      console.log('💰 Payment intent created:', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount
      });

      return new Response(
        JSON.stringify({ 
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          customerId: stripeCustomerId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('❌ Error creating payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});