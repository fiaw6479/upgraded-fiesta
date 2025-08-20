import { supabase } from '../lib/supabase';

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'trial' | 'monthly' | 'semiannual' | 'annual';
  status: 'active' | 'expired' | 'cancelled' | 'past_due';
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
  billing_period_text?: string;
  billing_period_accurate?: boolean;
}

export interface PlanFeatures {
  maxCustomers: number;
  maxBranches: number;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
  apiAccess: boolean;
}

export class SubscriptionService {
  static async createSubscription(
    userId: string,
    planType: 'trial' | 'monthly' | 'semiannual' | 'annual',
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ): Promise<Subscription> {
    try {
      console.log('🔄 Creating subscription:', { userId, planType, stripeSubscriptionId, stripeCustomerId });
      
      // Calculate proper periods
      const periodStart = new Date();
      let periodEnd = new Date(periodStart);
      
      switch (planType) {
        case 'trial':
          periodEnd.setDate(periodEnd.getDate() + 30);
          break;
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

      const { data: rpcResult, error: rpcError } = await supabase.rpc('handle_subscription_webhook', {
        p_user_id: userId,
        p_plan_type: planType,
        p_status: 'active',
        p_stripe_subscription_id: stripeSubscriptionId || null,
        p_stripe_customer_id: stripeCustomerId || null,
        p_period_start: periodStart.toISOString(),
        p_period_end: periodEnd.toISOString()
      });

      if (rpcError) {
        console.error('❌ RPC Error:', rpcError);
        throw new Error(`Failed to create subscription: ${rpcError.message}`);
      }

      console.log('✅ RPC Result:', rpcResult);

      // Fetch the created/updated subscription
      const { data: subscriptionData, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Fetch Error:', fetchError);
        throw new Error(`Failed to fetch subscription: ${fetchError.message}`);
      }

      if (!subscriptionData) {
        throw new Error('Subscription was not created properly');
      }

      console.log('✅ Subscription created/updated:', subscriptionData);
      return subscriptionData;
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  static async updateSubscription(
    subscriptionId: string,
    planType: 'trial' | 'monthly' | 'semiannual' | 'annual',
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ): Promise<Subscription> {
    try {
      const { data: currentSub, error: fetchError } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('id', subscriptionId)
        .single();

      if (fetchError) throw new Error(`Failed to fetch current subscription: ${fetchError.message}`);

      const { data: rpcResult, error: rpcError } = await supabase.rpc('handle_subscription_webhook', {
        p_user_id: currentSub.user_id,
        p_plan_type: planType as string,
        p_status: 'active' as string,
        p_stripe_subscription_id: stripeSubscriptionId || null,
        p_stripe_customer_id: stripeCustomerId || null,
        p_period_start: new Date().toISOString(),
        p_period_end: null
      });

      if (rpcError) throw new Error(`Failed to update subscription: ${rpcError.message}`);

      const { data: updatedSub, error: fetchUpdatedError } = await supabase
        .from('subscriptions')
        .select()
        .eq('id', subscriptionId)
        .single();

      if (fetchUpdatedError) throw fetchUpdatedError;
      return updatedSub;
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  static async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_subscription_with_periods', {
        user_id_param: userId
      });

      if (rpcError) {
        console.error('Error fetching subscription via RPC:', rpcError);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .maybeSingle();
        
        if (fallbackError) {
          console.error('Fallback query failed:', fallbackError);
          return null;
        }
        return fallbackData;
      }
      
      return data && data.length > 0 ? data[0] : null;
    } catch (error: any) {
      console.error('Error fetching user subscription:', error);
      return null;
    }
  }

  static async updateSubscriptionStatus(
    subscriptionId: string,
    status: 'active' | 'expired' | 'cancelled' | 'past_due'
  ): Promise<void> {
    try {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);

      if (updateError) throw updateError;
    } catch (error: any) {
      console.error('Error updating subscription status:', error);
      throw error;
    }
  }

  static async checkSubscriptionAccess(userId: string): Promise<{
    hasAccess: boolean;
    subscription: Subscription | null;
    features: PlanFeatures;
    daysRemaining?: number;
    isExpired?: boolean;
    isCancelled?: boolean;
    billingPeriodText?: string;
    billingPeriodAccurate?: boolean;
  }> {
    try {
      console.log('🔍 Checking subscription access for user:', userId);
      const subscription = await this.getUserSubscription(userId);
      console.log('📊 Raw subscription data:', subscription);
      return this.fallbackAccessCheck(subscription);
    } catch (error: any) {
      console.error('Error checking subscription access:', error);
      return {
        hasAccess: true,
        subscription: null,
        features: this.getTrialFeatures(),
        daysRemaining: 30,
        isExpired: false,
        isCancelled: false,
        billingPeriodText: 'Error loading billing period',
        billingPeriodAccurate: false
      };
    }
  }

  private static fallbackAccessCheck(subscription: Subscription | null) {
    console.log('🔍 Fallback access check for subscription:', subscription);
    
    if (!subscription) {
      console.log('❌ No subscription found, returning trial access');
      return {
        hasAccess: true,
        subscription: null,
        features: this.getTrialFeatures(),
        daysRemaining: 30,
        isExpired: false,
        isCancelled: false,
        billingPeriodText: 'No active subscription',
        billingPeriodAccurate: true
      };
    }

    const now = new Date();
    const endDate = new Date(subscription.current_period_end);
    const isExpired = endDate <= now;
    const isCancelled = subscription.status === 'cancelled';
    const hasAccess = (subscription.status === 'active' || (isCancelled && !isExpired)) && endDate > now;
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Use database billing period text if available, otherwise generate fallback
    let billingPeriodText = subscription.billing_period_text;
    let billingPeriodAccurate = subscription.billing_period_accurate;
    
    if (!billingPeriodText) {
      billingPeriodText = this.generateFallbackBillingPeriodText(subscription);
      billingPeriodAccurate = false; // Mark as inaccurate since it's a fallback
    }

    console.log('📊 Access check result:', {
      planType: subscription.plan_type,
      status: subscription.status,
      hasAccess,
      isExpired,
      isCancelled,
      daysRemaining,
      endDate: endDate.toISOString(),
      billingPeriodText,
      billingPeriodAccurate
    });

    return {
      hasAccess,
      subscription,
      features: this.getPlanFeatures(subscription.plan_type),
      daysRemaining: Math.max(0, daysRemaining),
      isExpired,
      isCancelled,
      billingPeriodText,
      billingPeriodAccurate
    };
  }

  private static generateFallbackBillingPeriodText(subscription: Subscription): string {
    const startDate = new Date(subscription.current_period_start);
    const endDate = new Date(subscription.current_period_end);
    const planDurationText = this.getPlanDurationText(subscription.plan_type);
    return `${startDate.toLocaleDateString('en-US')} – ${endDate.toLocaleDateString('en-US')} (${planDurationText})`;
  }

  private static getPlanDurationText(planType: string): string {
    switch (planType) {
      case 'trial': return '30 days';
      case 'monthly': return '1 month';
      case 'semiannual': return '6 months';
      case 'annual': return '1 year';
      default: return 'unknown';
    }
  }

  static getPlanFeatures(planType: 'trial' | 'monthly' | 'semiannual' | 'annual'): PlanFeatures {
    switch (planType) {
      case 'trial': return this.getTrialFeatures();
      case 'monthly':
      case 'semiannual':
      case 'annual':
        return {
          maxCustomers: -1,
          maxBranches: -1,
          advancedAnalytics: true,
          prioritySupport: true,
          customBranding: planType !== 'monthly',
          apiAccess: planType !== 'monthly'
        };
      default: return this.getTrialFeatures();
    }
  }

  private static getTrialFeatures(): PlanFeatures {
    return {
      maxCustomers: 100,
      maxBranches: 1,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false
    };
  }

  static async getAllSubscriptions(): Promise<(Subscription & { user_email?: string; restaurant_name?: string; })[]> {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_recent_subscriptions', { limit_count: 100 });
      if (rpcError) throw rpcError;

      return data || [];
    } catch (error: any) {
      console.error('Error fetching all subscriptions:', error);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallbackError) throw fallbackError;
      return (fallbackData || []).map(sub => ({
        ...sub,
        user_email: 'Unknown',
        restaurant_name: 'Unknown Restaurant'
      }));
    }
  }

  static async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    trial: number;
    paid: number;
    revenue: number;
    churnRate: number;
  }> {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_subscription_statistics');
      if (rpcError) throw rpcError;

      return {
        total: data.total || 0,
        active: data.active || 0,
        trial: data.trial || 0,
        paid: data.paid || 0,
        revenue: data.totalRevenue || 0,
        churnRate: data.churnRate || 0
      };
    } catch (error: any) {
      console.error('Error fetching subscription stats:', error);
      return { total: 0, active: 0, trial: 0, paid: 0, revenue: 0, churnRate: 0 };
    }
  }

  static async getSystemWideStats(): Promise<{
    totalRevenue: number;
    totalCustomers: number;
    totalRestaurants: number;
    totalTransactions: number;
    monthlyGrowth: number;
  }> {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_system_wide_stats');
      if (rpcError) throw rpcError;

      return {
        totalRevenue: data.totalRevenue || 0,
        totalCustomers: data.totalCustomers || 0,
        totalRestaurants: data.totalRestaurants || 0,
        totalTransactions: data.totalTransactions || 0,
        monthlyGrowth: 0
      };
    } catch (error: any) {
      console.error('Error fetching system-wide stats:', error);
      return { totalRevenue: 0, totalCustomers: 0, totalRestaurants: 0, totalTransactions: 0, monthlyGrowth: 0 };
    }
  }
}
