import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  User, Mail, Lock, Building, ArrowRight, ArrowLeft,
  CheckCircle, AlertCircle, Eye, EyeOff, CreditCard,
  Shield, Crown, Award, Sparkles, Loader2
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CustomCheckout from './CustomCheckout';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface PlanDetails {
  planId: string;
  name: string;
  price: string;
  period: string;
  features: string[];
}

const SignupPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signUp } = useAuth();
  
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('trial');
  const [autoRenew, setAutoRenew] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    restaurantName: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showCustomCheckout, setShowCustomCheckout] = useState(false);

  const plans: Record<string, PlanDetails> = {
    trial: {
      planId: 'trial',
      name: 'Free Trial',
      price: '$0',
      period: '1 month',
      features: [
        'Up to 100 customers',
        'Basic loyalty program',
        'QR code system',
        'Basic analytics',
        'Email support'
      ]
    },
    monthly: {
      planId: 'monthly',
      name: 'Monthly',
      price: '$2.99',
      period: 'per month',
      features: [
        'Unlimited customers',
        'Advanced loyalty features',
        'Multi-branch support',
        'Advanced analytics',
        'Priority support',
        'Custom rewards'
      ],
    },
    semiannual: {
      planId: 'semiannual',
      name: '6 Months',
      price: '$9.99',
      period: 'one-time',
      features: [
        'Everything in Monthly',
        'Advanced ROI analytics',
        'Custom branding',
        'API access',
        'Dedicated support'
      ],
    },
    annual: {
      planId: 'annual',
      name: '1 Year',
      price: '$19.99',
      period: 'one-time',
      features: [
        'Everything in 6 Months',
        'White-label solution',
        'Custom integrations',
        'Account manager',
        'Priority features'
      ],
    }
  };

  useEffect(() => {
    // Check if a plan was pre-selected from landing page
    const preSelectedPlan = location.state?.selectedPlan;
    if (preSelectedPlan && plans[preSelectedPlan]) {
      setSelectedPlan(preSelectedPlan);
    }
  }, [location.state]);

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Please enter a valid email';
    if (!formData.restaurantName.trim()) errors.restaurantName = 'Restaurant name is required';
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSignup = async () => {
    if (!validateStep1()) return;

    setLoading(true);
    setError('');

    try {
      // Create account first
      const result = await signUp(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        restaurantName: formData.restaurantName
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // Handle payment based on selected plan
      if (selectedPlan === 'trial') {
        // For trial, redirect directly to dashboard
        navigate('/login', { 
          state: { 
            message: 'Account created successfully! Please sign in to start your free trial.',
            email: formData.email
          }
        });
      } else {
        // For paid plans, show custom checkout
        setShowCustomCheckout(true);
      }
    } catch (err: any) {
      setError('Failed to complete signup. Please try signing in if your account was created.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    navigate('/login', { 
      state: { 
        message: 'Payment successful! Please sign in to access your account.',
        email: formData.email
      }
    });
  };

  const handlePaymentCancel = () => {
    setShowCustomCheckout(false);
  };

  const currentPlan = plans[selectedPlan];

  if (showCustomCheckout) {
    return (
      <CustomCheckout
        plan={currentPlan}
        autoRenew={autoRenew}
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 font-['Inter',sans-serif]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img src="/image.png" alt="VOYA" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold font-['Space_Grotesk'] bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                VOYA
              </span>
            </Link>
            <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <div className="w-full max-w-2xl">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all duration-300 ${
                step >= 1 ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > 1 ? <CheckCircle className="h-5 w-5" /> : '1'}
              </div>
              <div className={`w-16 h-1 rounded-full transition-all duration-300 ${
                step > 1 ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B]' : 'bg-gray-200'
              }`} />
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all duration-300 ${
                step >= 2 ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
            </div>
          </div>

          <motion.div
            className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {error && (
              <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}

            {/* Step 1: Account Details */}
            {step === 1 && (
              <div className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
                    Create Your Account
                  </h2>
                  <p className="text-gray-600">
                    Get started with Voya's loyalty platform in minutes
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="John"
                      />
                      {validationErrors.firstName && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="Doe"
                      />
                      {validationErrors.lastName && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="john@restaurant.com"
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Restaurant Name *
                    </label>
                    <div className="relative">
                      <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.restaurantName}
                        onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.restaurantName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="Your Restaurant Name"
                      />
                    </div>
                    {validationErrors.restaurantName && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.restaurantName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="Create a secure password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="Confirm your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {validationErrors.confirmPassword && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <Link
                    to="/"
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-6 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                  </Link>
                  <button
                    onClick={handleNext}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200"
                  >
                    Next: Choose Plan
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Plan Selection & Payment */}
            {step === 2 && (
              <div className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
                    Choose Your Plan
                  </h2>
                  <p className="text-gray-600">
                    Select the plan that best fits your restaurant's needs
                  </p>
                </div>

                {/* Plan Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {Object.values(plans).map((plan) => (
                    <button
                      key={plan.planId}
                      onClick={() => setSelectedPlan(plan.planId)}
                      className={`text-left p-6 rounded-xl border-2 transition-all duration-300 ${
                        selectedPlan === plan.planId
                          ? 'border-[#E6A85C] bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 font-['Space_Grotesk']">
                            {plan.name}
                          </h3>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                            <span className="text-gray-600">{plan.period}</span>
                          </div>
                        </div>
                        {selectedPlan === plan.planId && (
                          <CheckCircle className="h-6 w-6 text-[#E6A85C]" />
                        )}
                      </div>
                      <ul className="space-y-2">
                        {plan.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {feature}
                          </li>
                        ))}
                        {plan.features.length > 3 && (
                          <li className="text-sm text-gray-500">
                            +{plan.features.length - 3} more features
                          </li>
                        )}
                      </ul>
                    </button>
                  ))}
                </div>

                {/* Auto-Renew Toggle for Paid Plans */}
                {selectedPlan !== 'trial' && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Auto-Renew</p>
                        <p className="text-sm text-gray-600">
                          Automatically renew your subscription to avoid service interruption
                        </p>
                      </div>
                      <button
                        onClick={() => setAutoRenew(!autoRenew)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          autoRenew ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            autoRenew ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
                {/* Selected Plan Summary */}
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border border-gray-200 mb-8">
                  <h3 className="font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                    Order Summary
                  </h3>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-gray-900">{currentPlan.name}</p>
                      <p className="text-sm text-gray-600">{currentPlan.period}</p>
                      {selectedPlan !== 'trial' && (
                        <p className="text-sm text-gray-600">
                          Auto-Renew: {autoRenew ? 'Enabled' : 'Disabled'}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{currentPlan.price}</p>
                    </div>
                  </div>
                  
                  {selectedPlan !== 'trial' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-green-900">
                          Secure payment powered by Stripe
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleBack}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-6 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    onClick={handleSignup}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {selectedPlan === 'trial' ? (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Start Free Trial
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            Proceed to Checkout
                          </>
                        )}
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-6">
                  By creating an account, you agree to our{' '}
                  <Link to="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;