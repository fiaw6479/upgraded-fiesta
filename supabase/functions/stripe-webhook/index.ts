import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, stripe-signature",
};

interface WebhookProcessingResult {
  success: boolean;
  action: string;
  userId?: string;
  planType?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    
    if (!signature) {
      console.error('❌ No Stripe signature found');
      return new Response('No signature', { status: 400 });
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('❌ No webhook secret configured');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );

    console.log(`🎯 Processing webhook event: ${event.type} at ${new Date().toISOString()}`);

    let processingResult: WebhookProcessingResult = {
      success: false,
      action: 'unknown'
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        processingResult = await handleCheckoutCompleted(event, stripe, supabase);
        break;
      }

      case 'payment_intent.succeeded': {
        processingResult = await handlePaymentSucceeded(event, stripe, supabase);
        break;
      }

      case 'invoice.payment_succeeded': {
        processingResult = await handleInvoicePaymentSucceeded(event, stripe, supabase);
        break;
      }

      case 'invoice.payment_failed': {
        processingResult = await handleInvoicePaymentFailed(event, stripe, supabase);
        break;
      }

      case 'customer.subscription.updated': {
        processingResult = await handleSubscriptionUpdated(event, stripe, supabase);
        break;
      }

      case 'customer.subscription.deleted': {
        processingResult = await handleSubscriptionDeleted(event, stripe, supabase);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled webhook event type: ${event.type}`);
        processingResult = {
          success: true,
          action: 'ignored',
        };
    }

    return new Response(JSON.stringify({ 
      received: true, 
      processed: processingResult.success,
      action: processingResult.action,
      event_type: event.type,
      user_id: processingResult.userId,
      plan_type: processingResult.planType,
      timestamp: new Date().toISOString(),
      error: processingResult.error
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: processingResult.success ? 200 : 400,
    });
  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      event_type: 'unknown',
      timestamp: new Date().toISOString()
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleCheckoutCompleted(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: any
): Promise<WebhookProcessingResult> {
  try {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log('💳 Processing checkout completion:', {
      sessionId: session.id,
      userId: session.metadata?.user_id,
      planType: session.metadata?.plan_type,
      customerId: session.customer,
      subscriptionId: session.subscription,
      mode: session.mode
    });
    
    if (!session.metadata?.user_id || !session.metadata?.plan_type) {
      throw new Error('Missing required metadata in checkout session');
    }

    const userId = session.metadata.user_id;
    const planType = session.metadata.plan_type as 'monthly' | 'semiannual' | 'annual';
    
    let periodStart: Date;
    let periodEnd: Date;

    if (session.mode === 'subscription' && session.subscription) {
      // For subscription mode, get accurate periods from Stripe subscription
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      periodStart = new Date(subscription.current_period_start * 1000);
      periodEnd = new Date(subscription.current_period_end * 1000);
      
      console.log('📅 Subscription periods from Stripe:', {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        planType
      });
    } else {
      // For payment mode, calculate periods based on plan type
      periodStart = new Date();
      
      switch (planType) {
        case 'monthly':
          periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
        case 'semiannual':
          periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 6);
          break;
        case 'annual':
          periodEnd = new Date(periodStart);
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          break;
        default:
          throw new Error(`Invalid plan type: ${planType}`);
      }
      
      console.log('📅 Calculated periods for one-time payment:', {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        planType
      });
    }

    // Update subscription using the enhanced webhook handler
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: session.subscription as string || null,
      p_stripe_customer_id: session.customer as string,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString()
    });

    if (error) {
      console.error('❌ Database error in checkout completion:', error);
      throw error;
    }

    console.log('✅ Checkout completion processed successfully:', result);

    return {
      success: true,
      action: 'checkout_completed',
      userId,
      planType
    };
  } catch (error) {
    console.error('❌ Error handling checkout completion:', error);
    return {
      success: false,
      action: 'checkout_completed',
      error: error.message
    };
  }
}

async function handlePaymentSucceeded(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: any
): Promise<WebhookProcessingResult> {
  try {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log('💰 Processing payment success:', {
      paymentIntentId: paymentIntent.id,
      userId: paymentIntent.metadata?.user_id,
      planType: paymentIntent.metadata?.plan_type,
      amount: paymentIntent.amount,
      customerId: paymentIntent.customer
    });
    
    if (!paymentIntent.metadata?.user_id || !paymentIntent.metadata?.plan_type) {
      console.warn('⚠️ Payment intent missing metadata, skipping subscription update');
      return {
        success: true,
        action: 'payment_succeeded_no_metadata'
      };
    }

    const userId = paymentIntent.metadata.user_id;
    const planType = paymentIntent.metadata.plan_type as 'monthly' | 'semiannual' | 'annual';
    
    // Calculate proper billing periods for one-time payments
    const periodStart = new Date();
    let periodEnd = new Date(periodStart);
    
    switch (planType) {
      case 'monthly':
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        break;
      case 'semiannual':
        periodEnd.setMonth(periodEnd.getMonth() + 6);
        break;
      case 'annual':
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        break;
    }

    console.log('📅 One-time payment periods:', {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      planType
    });

    // Update subscription
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: null, // One-time payments don't have subscription IDs
      p_stripe_customer_id: paymentIntent.customer as string,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString()
    });

    if (error) {
      console.error('❌ Database error in payment success:', error);
      throw error;
    }

    console.log('✅ Payment success processed successfully:', result);

    return {
      success: true,
      action: 'payment_succeeded',
      userId,
      planType
    };
  } catch (error) {
    console.error('❌ Error handling payment success:', error);
    return {
      success: false,
      action: 'payment_succeeded',
      error: error.message
    };
  }
}

async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: any
): Promise<WebhookProcessingResult> {
  try {
    const invoice = event.data.object as Stripe.Invoice;
    console.log('📄 Processing invoice payment success:', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer,
      amount: invoice.amount_paid
    });
    
    if (!invoice.subscription) {
      console.log('ℹ️ Invoice not associated with subscription, skipping');
      return {
        success: true,
        action: 'invoice_payment_no_subscription'
      };
    }

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    console.log('📋 Retrieved subscription for invoice:', {
      subscriptionId: subscription.id,
      userId: subscription.metadata?.user_id,
      planType: subscription.metadata?.plan_type,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    });

    if (!subscription.metadata?.user_id) {
      console.warn('⚠️ Subscription missing user metadata');
      return {
        success: true,
        action: 'invoice_payment_no_user_metadata'
      };
    }

    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';

    // Update subscription with accurate Stripe periods
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      p_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    });

    if (error) {
      console.error('❌ Database error in invoice payment:', error);
      throw error;
    }

    console.log('✅ Invoice payment processed successfully:', result);

    return {
      success: true,
      action: 'invoice_payment_succeeded',
      userId,
      planType
    };
  } catch (error) {
    console.error('❌ Error handling invoice payment:', error);
    return {
      success: false,
      action: 'invoice_payment_succeeded',
      error: error.message
    };
  }
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: any
): Promise<WebhookProcessingResult> {
  try {
    const invoice = event.data.object as Stripe.Invoice;
    console.log('❌ Processing invoice payment failure:', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer
    });
    
    if (!invoice.subscription) {
      return {
        success: true,
        action: 'invoice_payment_failed_no_subscription'
      };
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    
    if (!subscription.metadata?.user_id) {
      return {
        success: true,
        action: 'invoice_payment_failed_no_user_metadata'
      };
    }

    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';

    // Update subscription status to past_due
    const { error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'past_due',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      p_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    });

    if (error) {
      console.error('❌ Error updating subscription to past_due:', error);
      throw error;
    }

    console.log('✅ Subscription marked as past_due for failed payment');

    return {
      success: true,
      action: 'invoice_payment_failed',
      userId,
      planType
    };
  } catch (error) {
    console.error('❌ Error handling invoice payment failure:', error);
    return {
      success: false,
      action: 'invoice_payment_failed',
      error: error.message
    };
  }
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: any
): Promise<WebhookProcessingResult> {
  try {
    const subscription = event.data.object as Stripe.Subscription;
    console.log('🔄 Processing subscription update:', {
      subscriptionId: subscription.id,
      userId: subscription.metadata?.user_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    });
    
    if (!subscription.metadata?.user_id) {
      return {
        success: true,
        action: 'subscription_updated_no_user_metadata'
      };
    }

    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';
    
    // Map Stripe status to our status
    let status: string;
    switch (subscription.status) {
      case 'active':
        status = 'active';
        break;
      case 'past_due':
        status = 'past_due';
        break;
      case 'canceled':
      case 'cancelled':
        status = 'cancelled';
        break;
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
        status = 'expired';
        break;
      default:
        status = 'active';
    }

    // Update subscription with accurate Stripe periods
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: status,
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      p_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    });

    if (error) {
      console.error('❌ Database error in subscription update:', error);
      throw error;
    }

    console.log('✅ Subscription update processed successfully:', result);

    return {
      success: true,
      action: 'subscription_updated',
      userId,
      planType
    };
  } catch (error) {
    console.error('❌ Error handling subscription update:', error);
    return {
      success: false,
      action: 'subscription_updated',
      error: error.message
    };
  }
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: any
): Promise<WebhookProcessingResult> {
  try {
    const subscription = event.data.object as Stripe.Subscription;
    console.log('🗑️ Processing subscription deletion:', {
      subscriptionId: subscription.id,
      userId: subscription.metadata?.user_id,
      customerId: subscription.customer
    });
    
    if (!subscription.metadata?.user_id) {
      return {
        success: true,
        action: 'subscription_deleted_no_user_metadata'
      };
    }

    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';

    // Update subscription status to cancelled
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'cancelled',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      p_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    });

    if (error) {
      console.error('❌ Error cancelling subscription:', error);
      throw error;
    }

    console.log('✅ Subscription cancellation processed successfully:', result);

    return {
      success: true,
      action: 'subscription_deleted',
      userId,
      planType
    };
  } catch (error) {
    console.error('❌ Error handling subscription deletion:', error);
    return {
      success: false,
      action: 'subscription_deleted',
      error: error.message
    };
  }
}