import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Calendar, DollarSign, Settings, AlertCircle,
  CheckCircle, Clock, RefreshCw, Download, Eye, MoreVertical,
  Plus, Trash2, Edit3, Shield, Crown, Zap, TrendingUp,
  Receipt, FileText, Bell, X, Loader2, Star, Check
} from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  is_default: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  created: number;
  invoice_pdf?: string;
  period_start: number;
  period_end: number;
}

const AddPaymentMethodForm: React.FC<{
  onSuccess: () => void;
  onCancel: () => void;
  customerId: string;
}> = ({ onSuccess, onCancel, customerId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment method
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message);
      }

      // Attach payment method to customer
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/attach-payment-method`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          customerId: customerId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add payment method');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Card Information
        </label>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#374151',
                  fontFamily: 'Inter, sans-serif',
                  '::placeholder': {
                    color: '#9CA3AF',
                  },
                },
                invalid: {
                  color: '#EF4444',
                },
              },
              hidePostalCode: false,
            }}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add Payment Method
            </>
          )}
        </button>
      </div>
    </form>
  );
};

const BillingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadBillingData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError('');

      console.log('💳 Loading billing data for user:', user.id);

      // Load subscription data
      const subscriptionData = await SubscriptionService.checkSubscriptionAccess(user.id);
      console.log('📊 Subscription data:', subscriptionData);
      setSubscription(subscriptionData);

      // Load payment methods if we have a Stripe customer
      if (subscriptionData?.subscription?.stripe_customer_id) {
        console.log('💳 Loading payment methods for customer:', subscriptionData.subscription.stripe_customer_id);
        await loadPaymentMethods(subscriptionData.subscription.stripe_customer_id);
        
        // Create mock invoice based on subscription
        const planAmounts: Record<string, number> = {
          monthly: 299,
          semiannual: 999,
          annual: 1999,
          trial: 0
        };

        const amount = planAmounts[subscriptionData.subscription.plan_type] || 0;
        
        if (amount > 0) {
          setInvoices([
            {
              id: `in_${subscriptionData.subscription.id.slice(-10)}`,
              amount,
              status: 'paid',
              created: Math.floor(new Date(subscriptionData.subscription.current_period_start).getTime() / 1000),
              period_start: Math.floor(new Date(subscriptionData.subscription.current_period_start).getTime() / 1000),
              period_end: Math.floor(new Date(subscriptionData.subscription.current_period_end).getTime() / 1000)
            }
          ]);
        } else {
          setInvoices([]);
        }
      } else {
        console.log('💳 No Stripe customer ID found');
        setPaymentMethods([]);
        setInvoices([]);
      }

    } catch (err: any) {
      console.error('❌ Error loading billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async (customerId: string) => {
    try {
      console.log('🔍 Fetching payment methods for customer:', customerId);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-methods`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Payment methods fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch payment methods: ${response.status}`);
      }

      const { paymentMethods: methods } = await response.json();
      console.log('✅ Payment methods loaded:', methods?.length || 0);
      setPaymentMethods(methods || []);
    } catch (error) {
      console.error('❌ Error loading payment methods:', error);
      setPaymentMethods([]);
    }
  };

  useEffect(() => {
    if (user) {
      loadBillingData();
    }
  }, [user]);

  // Listen for subscription updates
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      console.log('🔄 Billing page: Subscription update event received');
      // Force refresh billing data immediately
      setTimeout(() => {
        loadBillingData();
      }, 500);
      
      // Also refresh after a longer delay for webhook processing
      setTimeout(() => {
        loadBillingData();
      }, 5000);
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, []);

  const handleCancelSubscription = async () => {
    if (!subscription?.subscription?.id) return;

    try {
      setActionLoading('cancel');
      
      // Update subscription status to cancelled in our database
      await SubscriptionService.updateSubscriptionStatus(subscription.subscription.id, 'cancelled');
      
      // Refresh subscription data
      await loadBillingData();
      setShowCancelModal(false);
      setCancelReason('');
      
      // Show success message
      alert('Subscription cancelled successfully. You will retain access until the end of your billing period.');
      
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddPaymentMethodSuccess = async () => {
    setShowAddPaymentModal(false);
    if (subscription?.subscription?.stripe_customer_id) {
      await loadPaymentMethods(subscription.subscription.stripe_customer_id);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      setActionLoading(`remove-${paymentMethodId}`);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detach-payment-method`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove payment method');
      }

      if (subscription?.subscription?.stripe_customer_id) {
        await loadPaymentMethods(subscription.subscription.stripe_customer_id);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to remove payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    if (!subscription?.subscription?.stripe_customer_id) return;

    try {
      setActionLoading(`default-${paymentMethodId}`);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-default-payment-method`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId,
          customerId: subscription.subscription.stripe_customer_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set default payment method');
      }

      if (subscription?.subscription?.stripe_customer_id) {
        await loadPaymentMethods(subscription.subscription.stripe_customer_id);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to set default payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount / 100);
  };

  const getPlanDisplayName = (planType: string) => {
    switch (planType) {
      case 'monthly': return 'Monthly Plan';
      case 'semiannual': return '6-Month Plan';
      case 'annual': return 'Annual Plan';
      case 'trial': return 'Free Trial';
      default: return 'Unknown Plan';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'past_due': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBillingPeriodText = () => {
    if (!subscription?.subscription) return 'N/A';
    
    // Always use the billing period text from database if available
    if (subscription.subscription.billing_period_text) {
      return subscription.subscription.billing_period_text;
    }
    
    // Fallback calculation
    const startDate = subscription.subscription.current_period_start;
    const endDate = subscription.subscription.current_period_end;
    
    if (!startDate || !endDate) return 'N/A';
    
    const start = new Date(startDate).toLocaleDateString('en-US');
    const end = new Date(endDate).toLocaleDateString('en-US');
    const planDuration = getPlanDurationText(subscription.subscription.plan_type);
    
    return `${start} – ${end} (${planDuration})`;
  };

  const getPlanDurationText = (planType: string) => {
    switch (planType) {
      case 'trial': return '30 days';
      case 'monthly': return '1 month';
      case 'semiannual': return '6 months';
      case 'annual': return '1 year';
      default: return 'unknown';
    }
  };

  const getNextBillingInfo = () => {
    if (!subscription?.subscription) return { text: 'N/A', isOneTime: false };
    
    const plan = subscription.subscription.plan_type;
    const endDate = subscription.subscription.current_period_end;
    const isCancelled = subscription.isCancelled;
    
    if (isCancelled) {
      return { 
        text: endDate ? new Date(endDate).toLocaleDateString() : 'N/A', 
        isOneTime: true,
        label: 'Access Ends',
        isExpired: subscription.isExpired
      };
    }
    
    switch (plan) {
      case 'annual':
      case 'semiannual':
        return { 
          text: endDate ? new Date(endDate).toLocaleDateString() : 'N/A', 
          isOneTime: true,
          label: 'Plan Expires',
          isExpired: subscription.isExpired
        };
      case 'monthly':
        return { 
          text: endDate ? new Date(endDate).toLocaleDateString() : 'N/A', 
          isOneTime: false,
          label: 'Next Billing',
          isExpired: subscription.isExpired
        };
      case 'trial':
        return { 
          text: endDate ? new Date(endDate).toLocaleDateString() : 'N/A', 
          isOneTime: false,
          label: 'Trial Ends',
          isExpired: subscription.isExpired
        };
      default:
        return { text: 'N/A', isOneTime: false, label: 'Next Billing', isExpired: false };
    }
  };

  const shouldShowUpgradePrompt = () => {
    return subscription?.isExpired || 
           (subscription?.isCancelled && subscription?.isExpired) ||
           (!subscription?.hasAccess && subscription?.subscription?.status !== 'active');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-gray-600 mt-1">Manage your subscription and payment methods</p>
          </div>
          <button
            onClick={loadBillingData}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-2xl"></div>
          <div className="h-64 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const nextBillingInfo = getNextBillingInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-1">Manage your subscription and payment methods</p>
        </div>
        <button
          onClick={loadBillingData}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Upgrade Prompt for Expired/Cancelled Subscriptions */}
      {shouldShowUpgradePrompt() && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900">
                {subscription?.isExpired ? 'Subscription Expired' : 'No Active Subscription'}
              </h3>
              <p className="text-red-700">
                {subscription?.isExpired 
                  ? 'Your subscription has expired. Upgrade now to continue using all features.'
                  : 'You need an active subscription to access premium features.'
                }
              </p>
            </div>
            <button
              onClick={() => navigate('/upgrade')}
              className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <Crown className="h-4 w-4" />
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Subscription */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Crown className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
              <p className="text-sm text-gray-600">Your active subscription details</p>
            </div>
          </div>

          {subscription?.subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Plan</span>
                <span className="font-semibold text-gray-900">
                  {getPlanDisplayName(subscription.subscription.plan_type)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.subscription.status)}`}>
                  {subscription.subscription.status.charAt(0).toUpperCase() + subscription.subscription.status.slice(1)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">{nextBillingInfo.label}</span>
                <span className={`font-semibold ${nextBillingInfo.isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                  {nextBillingInfo.text}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Billing Period</span>
                <span className="font-semibold text-gray-900 text-sm">
                  {getBillingPeriodText()}
                </span>
              </div>

              {subscription.daysRemaining !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Days Remaining</span>
                  <span className={`font-semibold ${subscription.daysRemaining <= 7 ? 'text-red-600' : 'text-gray-900'}`}>
                    {subscription.daysRemaining} days
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                {subscription.isCancelled && !subscription.isExpired && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800 text-sm font-medium">
                      Subscription cancelled. Access continues until {nextBillingInfo.text}
                    </p>
                  </div>
                )}

                {subscription.isExpired && (
                  <button
                    onClick={() => navigate('/upgrade')}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Crown className="h-4 w-4" />
                    Reactivate Subscription
                  </button>
                )}

                {!subscription.isCancelled && !subscription.isExpired && subscription.subscription.plan_type !== 'trial' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-2 px-4 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">No active subscription</h4>
              <p className="text-gray-600 mb-6">
                You're currently on the free trial. Upgrade to unlock all features.
              </p>
              <button 
                onClick={() => navigate('/upgrade')}
                className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200"
              >
                Choose a Plan
              </button>
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
                <p className="text-sm text-gray-600">Manage your payment options</p>
              </div>
            </div>
            {subscription?.subscription?.stripe_customer_id && (
              <button
                onClick={() => setShowAddPaymentModal(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>

          {!subscription?.subscription?.stripe_customer_id ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No payment methods available</p>
              <p className="text-sm text-gray-400">Upgrade to a paid plan to manage payment methods</p>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No payment methods added</p>
              <button
                onClick={() => setShowAddPaymentModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Payment Method
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {method.card?.brand.toUpperCase()} •••• {method.card?.last4}
                      </p>
                      <p className="text-sm text-gray-600">
                        Expires {method.card?.exp_month}/{method.card?.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {method.is_default ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefaultPaymentMethod(method.id)}
                        disabled={actionLoading === `default-${method.id}`}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `default-${method.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Set Default'
                        )}
                      </button>
                    )}
                    <button 
                      onClick={() => handleRemovePaymentMethod(method.id)}
                      disabled={actionLoading === `remove-${method.id}`}
                      className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === `remove-${method.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Receipt className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Billing History</h3>
              <p className="text-sm text-gray-600">Download invoices and view payment history</p>
            </div>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No billing history available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Period</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">
                      {formatDate(invoice.created)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage & Limits */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Plan Features</h3>
            <p className="text-sm text-gray-600">Available features in your current plan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Customers</span>
              <span className="text-sm font-medium text-gray-900">
                {subscription?.features?.maxCustomers === -1 ? 'Unlimited' : `${subscription?.features?.maxCustomers || 100} max`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Branches</span>
              <span className="text-sm font-medium text-gray-900">
                {subscription?.features?.maxBranches === -1 ? 'Unlimited' : `${subscription?.features?.maxBranches || 1} max`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Multi-Branch Support</span>
              <span className={`text-sm font-medium ${subscription?.features?.maxBranches > 1 ? 'text-green-600' : 'text-gray-400'}`}>
                {subscription?.features?.maxBranches > 1 ? 'Included' : 'Not Available'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Custom Branding</span>
              <span className={`font-semibold ${subscription?.features?.customBranding ? 'text-green-600' : 'text-gray-400'}`}>
                {subscription?.features?.customBranding ? 'Included' : 'Not Available'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Advanced Analytics</span>
              <span className={`text-sm font-medium ${subscription?.features?.advancedAnalytics ? 'text-green-600' : 'text-gray-400'}`}>
                {subscription?.features?.advancedAnalytics ? 'Included' : 'Not Available'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Priority Support</span>
              <span className={`text-sm font-medium ${subscription?.features?.prioritySupport ? 'text-green-600' : 'text-gray-400'}`}>
                {subscription?.features?.prioritySupport ? 'Included' : 'Not Available'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Access</span>
              <span className={`text-sm font-medium ${subscription?.features?.apiAccess ? 'text-green-600' : 'text-gray-400'}`}>
                {subscription?.features?.apiAccess ? 'Included' : 'Not Available'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">White-Label Solution</span>
              <span className={`font-semibold ${subscription?.subscription?.plan_type === 'annual' ? 'text-green-600' : 'text-gray-400'}`}>
                {subscription?.subscription?.plan_type === 'annual' ? 'Included' : 'Not Available'}
              </span>
            </div>
          </div>
        </div>

        {subscription?.subscription?.plan_type === 'trial' && (
          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-900">Trial Period</p>
                <p className="text-sm text-yellow-700">
                  {subscription.daysRemaining > 0 
                    ? `${subscription.daysRemaining} days remaining in your free trial`
                    : 'Your trial has expired'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/upgrade')}
              className="mt-3 w-full py-2 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium"
            >
              Upgrade Now
            </button>
          </div>
        )}
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Cancel Subscription</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900 mb-1">Are you sure?</p>
                    <p className="text-red-700 text-sm">
                      Cancelling your subscription will:
                    </p>
                    <ul className="text-red-700 text-sm mt-2 space-y-1 list-disc list-inside">
                      <li>End access to premium features after your billing period</li>
                      <li>Stop automatic billing</li>
                      <li>Limit customer capacity to 100</li>
                      <li>Remove advanced analytics and reporting</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for cancellation (optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Help us improve by telling us why you're cancelling..."
                  rows={3}
                />
              </div>

              <p className="text-gray-600 text-sm">
                Your subscription will remain active until {nextBillingInfo.text}.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading === 'cancel'}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'cancel' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Cancel Subscription'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Add Payment Method</h3>
              <button
                onClick={() => setShowAddPaymentModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <Elements stripe={stripePromise}>
              <AddPaymentMethodForm
                onSuccess={handleAddPaymentMethodSuccess}
                onCancel={() => setShowAddPaymentModal(false)}
                customerId={subscription?.subscription?.stripe_customer_id || ''}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}; 

export default BillingPage;