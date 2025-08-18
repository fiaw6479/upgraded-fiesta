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

    const { customerId } = await req.json();

    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    console.log('🔍 Fetching payment methods for customer:', customerId);

    // Get payment methods for customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    console.log('💳 Found payment methods:', paymentMethods.data.length);

    // Get customer to check default payment method
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    console.log('🎯 Default payment method ID:', defaultPaymentMethodId);

    // Format payment methods for frontend
    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      } : undefined,
      is_default: pm.id === defaultPaymentMethodId
    }));

    console.log('✅ Formatted payment methods:', formattedMethods);

    return new Response(
      JSON.stringify({ paymentMethods: formattedMethods }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});