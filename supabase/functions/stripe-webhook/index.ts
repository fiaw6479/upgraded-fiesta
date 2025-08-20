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
  billingPeriodAccurate?: boolean;
  actualDuration?: number;
}

interface PeriodCalculation {
  start: Date;
  end: Date;
  source: 'stripe_subscription' | 'stripe_invoice' | 'calculated';
  durationDays: number;
  isAccurate: boolean;
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
    console.log(`📊 Event ID: ${event.id}, Created: ${new Date(event.created * 1000).toISOString()}`);

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

    console.log(`📈 Webhook processing completed:`, {
      eventType: event.type,
      success: processingResult.success,
      action: processingResult.action,
      userId: processingResult.userId,
      planType: processingResult.planType,
      billingPeriodAccurate: processingResult.billingPeriodAccurate,
      actualDuration: processingResult.actualDuration,
      error: processingResult.error
    });

    return new Response(JSON.stringify({ 
      received: true, 
      processed: processingResult.success,
      action: processingResult.action,
      event_type: event.type,
      user_id: processingResult.userId,
      plan_type: processingResult.planType,
      billing_period_accurate: processingResult.billingPeriodAccurate,
      actual_duration_days: processingResult.actualDuration,
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

function calculatePeriodFromStripe(
  subscription: Stripe.Subscription,
  planType: string
): PeriodCalculation {
  const start = new Date(subscription.current_period_start * 1000);
  const end = new Date(subscription.current_period_end * 1000);
  const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determine if the period is accurate based on plan type
  let isAccurate = true;
  switch (planType) {
    case 'monthly':
      isAccurate = durationDays >= 28 && durationDays <= 31;
      break;
    case 'semiannual':
      isAccurate = durationDays >= 180 && durationDays <= 186;
      break;
    case 'annual':
      isAccurate = durationDays >= 360 && durationDays <= 370;
      break;
    case 'trial':
      isAccurate = durationDays >= 28 && durationDays <= 32;
      break;
  }

  console.log(`📅 Stripe subscription period analysis:`, {
    planType,
    start: start.toISOString(),
    end: end.toISOString(),
    durationDays,
    isAccurate,
    source: 'stripe_subscription'
  });

  return {
    start,
    end,
    source: 'stripe_subscription',
    durationDays,
    isAccurate
  };
}

function calculatePeriodForPayment(planType: string): PeriodCalculation {
  const start = new Date();
  let end = new Date(start);
  let expectedDays: number;
  
  switch (planType) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      expectedDays = 30;
      break;
    case 'semiannual':
      end.setMonth(end.getMonth() + 6);
      expectedDays = 183;
      break;
    case 'annual':
      end.setFullYear(end.getFullYear() + 1);
      expectedDays = 365;
      break;
    case 'trial':
      end.setDate(end.getDate() + 30);
      expectedDays = 30;
      break;
    default:
      throw new Error(`Invalid plan type: ${planType}`);
  }

  const actualDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log(`📅 Calculated payment period:`, {
    planType,
    start: start.toISOString(),
    end: end.toISOString(),
    expectedDays,
    actualDays,
    source: 'calculated'
  });

  return {
    start,
    end,
    source: 'calculated',
    durationDays: actualDays,
    isAccurate: true // Calculated periods are considered accurate
  };
}

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
      mode: session.mode,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total
    });
    
    if (!session.metadata?.user_id || !session.metadata?.plan_type) {
      throw new Error('Missing required metadata in checkout session');
    }

    const userId = session.metadata.user_id;
    const planType = session.metadata.plan_type as 'monthly' | 'semiannual' | 'annual' | 'trial';
    
    let periodCalculation: PeriodCalculation;

    if (session.mode === 'subscription' && session.subscription) {
      // For subscription mode, get accurate periods from Stripe subscription
      console.log('🔄 Retrieving subscription details from Stripe...');
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      periodCalculation = calculatePeriodFromStripe(subscription, planType);
      
      console.log('✅ Using Stripe subscription periods for checkout completion');
    } else {
      // For payment mode, calculate periods based on plan type
      console.log('💰 Calculating periods for one-time payment...');
      periodCalculation = calculatePeriodForPayment(planType);
      
      console.log('✅ Using calculated periods for one-time payment');
    }

    // Update subscription using the enhanced webhook handler
    console.log('💾 Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: session.subscription as string || null,
      p_stripe_customer_id: session.customer as string,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });

    if (error) {
      console.error('❌ Database error in checkout completion:', error);
      throw error;
    }

    console.log('✅ Checkout completion processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });

    return {
      success: true,
      action: 'checkout_completed',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
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
      currency: paymentIntent.currency,
      customerId: paymentIntent.customer,
      status: paymentIntent.status
    });
    
    if (!paymentIntent.metadata?.user_id || !paymentIntent.metadata?.plan_type) {
      console.warn('⚠️ Payment intent missing metadata, skipping subscription update');
      return {
        success: true,
        action: 'payment_succeeded_no_metadata'
      };
    }

    const userId = paymentIntent.metadata.user_id;
    const planType = paymentIntent.metadata.plan_type as 'monthly' | 'semiannual' | 'annual' | 'trial';
    
    // For payment intents, we always calculate periods since they're one-time payments
    console.log('📊 Calculating billing periods for one-time payment...');
    const periodCalculation = calculatePeriodForPayment(planType);

    console.log('💾 Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: null, // One-time payments don't have subscription IDs
      p_stripe_customer_id: paymentIntent.customer as string,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });

    if (error) {
      console.error('❌ Database error in payment success:', error);
      throw error;
    }

    console.log('✅ Payment success processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });

    return {
      success: true,
      action: 'payment_succeeded',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
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
      amount: invoice.amount_paid,
      currency: invoice.currency,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      billingReason: invoice.billing_reason
    });
    
    if (!invoice.subscription) {
      console.log('ℹ️ Invoice not associated with subscription, skipping');
      return {
        success: true,
        action: 'invoice_payment_no_subscription'
      };
    }

    // Get subscription details from Stripe for the most accurate data
    console.log('🔄 Retrieving subscription details from Stripe...');
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    console.log('📋 Retrieved subscription for invoice:', {
      subscriptionId: subscription.id,
      userId: subscription.metadata?.user_id,
      planType: subscription.metadata?.plan_type,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
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

    // Use Stripe subscription periods for maximum accuracy
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);

    // Cross-reference with invoice periods for validation
    if (invoice.period_start && invoice.period_end) {
      const invoiceStart = new Date(invoice.period_start * 1000);
      const invoiceEnd = new Date(invoice.period_end * 1000);
      const invoiceDuration = Math.ceil((invoiceEnd.getTime() - invoiceStart.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log('🔍 Cross-referencing with invoice periods:', {
        invoiceStart: invoiceStart.toISOString(),
        invoiceEnd: invoiceEnd.toISOString(),
        invoiceDuration,
        subscriptionDuration: periodCalculation.durationDays,
        periodsMatch: Math.abs(invoiceDuration - periodCalculation.durationDays) <= 1
      });
    }

    console.log('💾 Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });

    if (error) {
      console.error('❌ Database error in invoice payment:', error);
      throw error;
    }

    console.log('✅ Invoice payment processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });

    return {
      success: true,
      action: 'invoice_payment_succeeded',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
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
      customerId: invoice.customer,
      amountDue: invoice.amount_due,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt
    });
    
    if (!invoice.subscription) {
      console.log('ℹ️ Invoice payment failure not associated with subscription, skipping');
      return {
        success: true,
        action: 'invoice_payment_failed_no_subscription'
      };
    }

    console.log('🔄 Retrieving subscription details for failed payment...');
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    
    if (!subscription.metadata?.user_id) {
      console.warn('⚠️ Subscription missing user metadata for failed payment');
      return {
        success: true,
        action: 'invoice_payment_failed_no_user_metadata'
      };
    }

    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';

    // Use actual Stripe periods even for failed payments
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);

    console.log('💾 Updating subscription status to past_due...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'past_due',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });

    if (error) {
      console.error('❌ Error updating subscription to past_due:', error);
      throw error;
    }

    console.log('✅ Subscription marked as past_due for failed payment:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays
    });

    return {
      success: true,
      action: 'invoice_payment_failed',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
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
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end
    });
    
    if (!subscription.metadata?.user_id) {
      console.warn('⚠️ Subscription update missing user metadata');
      return {
        success: true,
        action: 'subscription_updated_no_user_metadata'
      };
    }

    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';
    
    // Map Stripe status to our status with enhanced logging
    let status: string;
    switch (subscription.status) {
      case 'active':
        status = 'active';
        console.log('✅ Subscription is active');
        break;
      case 'past_due':
        status = 'past_due';
        console.log('⚠️ Subscription is past due');
        break;
      case 'canceled':
      case 'cancelled':
        status = 'cancelled';
        console.log('❌ Subscription is cancelled');
        break;
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
        status = 'expired';
        console.log('💸 Subscription is expired/incomplete');
        break;
      case 'trialing':
        status = 'active'; // Treat trialing as active
        console.log('🆓 Subscription is in trial period');
        break;
      default:
        status = 'active';
        console.log(`❓ Unknown subscription status: ${subscription.status}, defaulting to active`);
    }

    // Always use actual Stripe periods for subscription updates
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);

    console.log('💾 Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: status,
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });

    if (error) {
      console.error('❌ Database error in subscription update:', error);
      throw error;
    }

    console.log('✅ Subscription update processed successfully:', {
      result,
      statusChange: status,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });

    return {
      success: true,
      action: 'subscription_updated',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
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
      customerId: subscription.customer,
      canceledAt: subscription.canceled_at,
      endedAt: subscription.ended_at,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    });
    
    if (!subscription.metadata?.user_id) {
      console.warn('⚠️ Subscription deletion missing user metadata');
      return {
        success: true,
        action: 'subscription_deleted_no_user_metadata'
      };
    }

    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';

    // Use actual Stripe periods even for deleted subscriptions
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);

    console.log('💾 Updating subscription status to cancelled...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'cancelled',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer as string,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });

    if (error) {
      console.error('❌ Error cancelling subscription:', error);
      throw error;
    }

    console.log('✅ Subscription cancellation processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      finalPeriodAccurate: periodCalculation.isAccurate
    });

    return {
      success: true,
      action: 'subscription_deleted',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
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