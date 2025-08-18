import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, Lock, Shield, CheckCircle, ArrowLeft, 
  AlertCircle, Loader2, Crown, Star, Gift, Zap
} from 'lucide-react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface Plan {
  planId: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  savings?: string;
}

interface CustomCheckoutProps {
  plan: Plan;
  autoRenew: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const CheckoutForm: React.FC<{
  plan: Plan;
  autoRenew: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ plan, autoRenew, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !user) {
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
        billing_details: {
          email: user.email,
        },
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message);
      }

      // Get fresh session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication error. Please refresh and try again.');
      }

      // Create payment intent or subscription
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType: plan.planId,
          autoRenew,
          paymentMethodId: paymentMethod.id,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment processing failed');
      }

      const { clientSecret, subscriptionId } = await response.json();

      // Confirm payment with card details
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: user.email,
          },
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      console.log('✅ Payment confirmed successfully:', {
        paymentIntentId: paymentIntent?.id,
        status: paymentIntent?.status
      });
      // Payment successful
      onSuccess();
      
      // Trigger immediate subscription update events
      window.dispatchEvent(new CustomEvent('subscription-updated'));
      
      // Also trigger with delays to handle webhook processing
      setTimeout(() => {
        console.log('🔄 Triggering subscription update event');
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      }, 3000);
      
      setTimeout(() => {
        console.log('🔄 Final subscription update event');
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      }, 8000);

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Plan Summary */}
      <div className="bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10 rounded-xl p-6 border border-[#E6A85C]/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
            <p className="text-gray-600">{plan.description}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{plan.price}</p>
            <p className="text-sm text-gray-600">{plan.period}</p>
          </div>
        </div>
        
        {plan.savings && (
          <div className="bg-green-100 border border-green-200 rounded-lg p-3">
            <p className="text-green-800 font-medium text-sm">{plan.savings}</p>
          </div>
        )}
      </div>

      {/* Payment Details */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Payment Information
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

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">Secure Payment</p>
              <p className="text-xs text-blue-700">
                Your payment is secured by Stripe with 256-bit SSL encryption
              </p>
            </div>
          </div>
        </div>

        {/* Auto-Renew Info */}
        {autoRenew && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Auto-Renewal Enabled</p>
                <p className="text-xs text-yellow-700">
                  Your subscription will automatically renew to avoid service interruption
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
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
          className="flex-1 py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Complete Payment {plan.price}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

const CustomCheckout: React.FC<CustomCheckoutProps> = ({ plan, autoRenew, onSuccess, onCancel }) => {
  const elementsOptions: StripeElementsOptions = {
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#E6A85C',
        colorBackground: '#ffffff',
        colorText: '#374151',
        colorDanger: '#EF4444',
        fontFamily: 'Inter, sans-serif',
        spacingUnit: '4px',
        borderRadius: '12px',
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <img src="/image.png" alt="VOYA" className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
            Complete Your Upgrade
          </h2>
          <p className="text-gray-600">
            Secure payment powered by Stripe
          </p>
        </div>

        <Elements stripe={stripePromise} options={elementsOptions}>
          <CheckoutForm
            plan={plan}
            autoRenew={autoRenew}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        </Elements>
      </motion.div>
    </div>
  );
};

export default CustomCheckout;