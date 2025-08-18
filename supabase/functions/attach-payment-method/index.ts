import Stripe from "npm:stripe@18.4.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { paymentMethodId, customerId } = await req.json();

    if (!paymentMethodId || !customerId) {
      throw new Error('Payment method ID and customer ID are required');
    }

    console.log('🔗 Attaching payment method:', { paymentMethodId, customerId });

    // Attach payment method to customer
    const attachedPaymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    console.log('✅ Payment method attached successfully:', attachedPaymentMethod.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        paymentMethod: {
          id: attachedPaymentMethod.id,
          type: attachedPaymentMethod.type,
          card: attachedPaymentMethod.card
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error attaching payment method:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});