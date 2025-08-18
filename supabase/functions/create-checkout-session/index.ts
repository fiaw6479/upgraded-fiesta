import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CheckoutRequest {
  planType: 'monthly' | 'semiannual' | 'annual';
  autoRenew: boolean;
  successUrl: string;
  cancelUrl: string;
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

    const { planType, autoRenew, successUrl, cancelUrl }: CheckoutRequest = await req.json();

    // Define price mapping
    const priceMap = {
      monthly: Deno.env.get('STRIPE_MONTHLY_PRICE_ID'),
      semiannual: Deno.env.get('STRIPE_SEMIANNUAL_PRICE_ID'), 
      annual: Deno.env.get('STRIPE_ANNUAL_PRICE_ID')
    };

    // Validate that we have a valid price ID
    const priceId = priceMap[planType];
    if (!priceId) {
      throw new Error(`Price ID not configured for plan: ${planType}. Please configure Stripe price IDs in environment variables.`);
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;

    // Check if user already has a Stripe customer ID
    const { data: existingSubscription } = await supabaseClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (existingSubscription?.stripe_customer_id) {
      stripeCustomerId = existingSubscription.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Create checkout session with custom branding
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: autoRenew ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        plan_type: planType,
        auto_renew: autoRenew.toString(),
      },
      subscription_data: autoRenew ? {
        metadata: {
          user_id: user.id,
          plan_type: planType,
        },
      } : undefined,
      payment_intent_data: !autoRenew ? {
        metadata: {
          user_id: user.id,
          plan_type: planType,
        },
      } : undefined,
      // Custom branding
      custom_text: {
        submit: {
          message: 'Complete your VOYA subscription upgrade'
        }
      },
      // Only enable invoice creation for payment mode (not subscription mode)
      ...(autoRenew ? {} : {
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `VOYA ${planType} subscription`,
            metadata: {
              user_id: user.id,
              plan_type: planType,
            }
          }
        }
      })
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});