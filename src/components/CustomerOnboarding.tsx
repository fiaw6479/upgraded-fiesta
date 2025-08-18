import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Phone, Calendar, ArrowRight, ArrowLeft, 
  CheckCircle, Search, UserPlus, Sparkles, Gift, Star,
  Trophy, Heart, Zap, Eye, EyeOff, Lock,
  Shield, MessageSquare, Loader2, Crown, Award
} from 'lucide-react';
import { CustomerService } from '../services/customerService';




interface Restaurant {
  id: string;
  name: string;
  slug: string;
  settings: any;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  total_points: number;
  lifetime_points: number;
  current_tier: 'bronze' | 'silver' | 'gold';
  tier_progress: number;
  visit_count: number;
  total_spent: number;
  last_visit?: string;
  created_at: string;
}

interface CustomerOnboardingProps {
  restaurant: Restaurant;
  onComplete: (customer: Customer) => void;
}

const CustomerOnboarding: React.FC<CustomerOnboardingProps> = ({ restaurant, onComplete }) => {
  const [step, setStep] = useState(0); // 0: welcome, 1: auth form
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login'); // Default to login
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleEmailCheck = async (email: string) => {
    if (!email || email.length < 3) {
      setExistingCustomer(null);
      return;
    }

    setEmailCheckLoading(true);
    try {
      const customer = await CustomerService.getCustomerByEmail(restaurant.id, email);
      if (customer) {
        setExistingCustomer(customer);
        // Don't auto-switch to login mode, let user choose
      } else {
        setExistingCustomer(null);
      }
    } catch (err) {
      setExistingCustomer(null);
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!formData.email.trim()) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const customer = await CustomerService.getCustomerByEmail(restaurant.id, formData.email);
      if (customer) {
        onComplete(customer);
      } else {
        setError('Customer not found');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const newCustomer = await CustomerService.createCustomer(restaurant.id, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone || undefined,
        date_of_birth: formData.birthDate || undefined
      });

      onComplete(newCustomer);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden font-['Inter',sans-serif]">
      {/* Modern Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <motion.div 
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/image.png" alt="VOYA" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg font-['Space_Grotesk',sans-serif]">{restaurant.name}</h1>
              <p className="text-xs text-gray-500">Loyalty Program</p>
            </div>
          </motion.div>
          
          {step > 0 && (
            <motion.button
              onClick={() => setStep(0)}
              className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </motion.header>

      <div className="flex items-center justify-center min-h-screen p-4 pt-20">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div
                key="welcome"
                className="text-center space-y-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Hero Section */}
                <div className="space-y-6">
                  {/* Animated Chef Hat */}
                  <motion.div 
                    className="flex justify-center"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                  >
                    <img src="/image.png" alt="VOYA" className="w-32 h-32 object-contain" />
                  </motion.div>
                  
                  {/* Welcome Text with Reveal Animation */}
                  <div className="space-y-4">
                    <motion.h1 
                      className="text-4xl font-bold text-gray-900 leading-tight font-['Space_Grotesk',sans-serif]"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.8 }}
                    >
                      Welcome to {restaurant.name}
                    </motion.h1>
                    <motion.p 
                      className="text-lg text-gray-600 leading-relaxed max-w-sm mx-auto"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.8 }}
                    >
                      Join our loyalty program and start earning rewards
                    </motion.p>
                  </div>
                </div>

                {/* CTA Button */}
                <motion.button
                  onClick={() => setStep(1)}
                  className="w-full bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-bold py-4 px-8 rounded-xl hover:shadow-lg transition-all duration-300 text-lg"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  whileHover={{ 
                    scale: 1.02, 
                    y: -2,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get Started
                </motion.button>
              </motion.div>
            )}

            {/* Step 1: Auth Form */}
            {step === 1 && (
              <motion.div
                key="auth"
                className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              >
                {error && (
                  <motion.div 
                    className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-4 text-sm"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {error}
                  </motion.div>
                )}

                <div className="p-6 space-y-6">
                  {/* Header */}
                  <motion.div 
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.6 }}
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <img src="/image.png" alt="VOYA" className="w-10 h-10 object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 font-['Space_Grotesk',sans-serif]">
                      {authMode === 'login' ? 'Welcome Back!' : 'Join Our Program'}
                    </h2>
                    <p className="text-gray-600">
                      {authMode === 'login' ? 'Sign in to access your loyalty account' : 'Create your account and start earning rewards'}
                    </p>
                  </motion.div>

                  {/* Email Field */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          handleInputChange('email', e.target.value);
                          handleEmailCheck(e.target.value);
                        }}
                        className="w-full pl-12 pr-10 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                        placeholder="Enter your email address"
                      />
                      {emailCheckLoading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Existing Customer Detection */}
                  <AnimatePresence>
                    {existingCustomer && (
                      <motion.div 
                        className="bg-blue-50 border border-blue-200 rounded-xl p-4"
                        initial={{ opacity: 0, height: 0, scale: 0.9 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.9 }}
                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-lg flex items-center justify-center text-white font-bold">
                            {existingCustomer.first_name[0]}{existingCustomer.last_name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-blue-900">Welcome back!</p>
                            <p className="text-sm text-blue-700">
                              {existingCustomer.first_name} {existingCustomer.last_name}
                            </p>
                            <p className="text-sm text-blue-600">
                              {existingCustomer.total_points} points • {existingCustomer.current_tier} tier
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Signup Fields */}
                  <AnimatePresence>
                    {authMode === 'signup' && (
                      <motion.div 
                        className="space-y-6"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              First Name
                            </label>
                            <input
                              type="text"
                              value={formData.firstName}
                              onChange={(e) => handleInputChange('firstName', e.target.value)}
                              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                              placeholder="John"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Last Name
                            </label>
                            <input
                              type="text"
                              value={formData.lastName}
                              onChange={(e) => handleInputChange('lastName', e.target.value)}
                              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                              placeholder="Doe"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Phone Number (Optional)
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                              placeholder="+971 50 123 4567"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Date of Birth (Optional)
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="date"
                              value={formData.birthDate}
                              onChange={(e) => handleInputChange('birthDate', e.target.value)}
                              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Button */}
                  <motion.button
                    onClick={authMode === 'login' ? handleLogin : handleSignup}
                    disabled={loading || !formData.email.trim() || (authMode === 'signup' && (!formData.firstName.trim() || !formData.lastName.trim()))}
                    className="w-full bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-bold py-4 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {authMode === 'login' ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>

                  {/* Toggle Auth Mode */}
                  <motion.div 
                    className="text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                  >
                    <button
                      onClick={() => {
                        setAuthMode(authMode === 'login' ? 'signup' : 'login');
                        setError('');
                        setExistingCustomer(null);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-300"
                    >
                      {authMode === 'login' 
                        ? "Don't have an account? Sign up" 
                        : 'Already have an account? Sign in'
                      }
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence> 
        </div>
      </div>
    </div>
  );
};

export default CustomerOnboarding;