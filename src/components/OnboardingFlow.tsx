import React, { useState } from 'react';
import { 
  User, Mail, Phone, Calendar, ArrowRight, ArrowLeft, 
  CheckCircle, Search, UserPlus, Sparkles, Gift, Star,
  Trophy, Heart, Zap
} from 'lucide-react';
import { CustomerService } from '../services/customerService';
import { useAuth } from '../contexts/AuthContext';

interface OnboardingFlowProps {
  onComplete: (userData: any) => void;
  restaurantId?: string;
  restaurantName?: string;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, restaurantId, restaurantName = 'Our Restaurant' }) => {
  const [step, setStep] = useState(0); // Start with welcome step
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    isExisting: false,
    customerId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { restaurant } = useAuth();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleEmailSearch = async (email: string) => {
    if (!email || email.length < 3 || !restaurant) {
      setSearchResults([]);
      return;
    }

    try {
      const customer = await CustomerService.getCustomerByEmail(restaurant.id, email);
      if (customer) {
        setSearchResults([customer]);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      setSearchResults([]);
    }
  };

  const selectExistingCustomer = (customer: any) => {
    setFormData({
      name: `${customer.first_name} ${customer.last_name}`,
      email: customer.email,
      phone: customer.phone || '',
      birthDate: customer.date_of_birth || '',
      isExisting: true,
      customerId: customer.id
    });
    setSearchResults([]);
    setStep(4); // Skip to confirmation
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setError('Please enter your name');
        return;
      }
      if (!formData.email.trim()) {
        setError('Please enter your email');
        return;
      }
      if (!/\S+@\S+\.\S+/.test(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      console.log('🎯 Completing onboarding with data:', formData);
      await onComplete(formData);
    } catch (err: any) {
      console.error('❌ Onboarding completion failed:', err);
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator - only show for steps 1-4 */}
        {step > 0 && (
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3, 4].map((stepNumber) => (
              <React.Fragment key={stepNumber}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all duration-300 ${
                  step >= stepNumber 
                    ? 'bg-gradient-to-r from-[#1E2A78] to-[#3B4B9A] text-white shadow-lg' 
                    : 'bg-white text-gray-400 border-2 border-gray-200'
                }`}>
                  {step > stepNumber ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    stepNumber
                  )}
                </div>
                {stepNumber < 4 && (
                  <div className={`w-12 h-1 mx-2 rounded-full transition-all duration-300 ${
                    step > stepNumber ? 'bg-gradient-to-r from-[#1E2A78] to-[#3B4B9A]' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          {/* Step 0: Welcome/Get Started */}
          {step === 0 && (
            <div className="space-y-8 text-center">
              <div className="space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-[#1E2A78] to-[#3B4B9A] rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
                
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold text-gray-900">
                    Welcome to {restaurantName}!
                  </h1>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    Join our exclusive loyalty program and start earning rewards with every visit
                  </p>
                </div>
              </div>

              {/* Benefits showcase */}
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Gift className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-green-900">Earn Points</p>
                    <p className="text-sm text-green-700">Get points with every purchase</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-blue-900">Exclusive Rewards</p>
                    <p className="text-sm text-blue-700">Redeem points for amazing rewards</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-purple-900">VIP Status</p>
                    <p className="text-sm text-purple-700">Unlock higher tiers for better perks</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#1E2A78] to-[#3B4B9A] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <User className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's Get Started</h2>
                <p className="text-gray-600">Tell us a bit about yourself</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E2A78] focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      handleInputChange('email', e.target.value);
                      handleEmailSearch(e.target.value);
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E2A78] focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Enter your email address"
                  />
                </div>

                {/* Existing customer search results */}
                {searchResults.length > 0 && (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm font-medium text-blue-900 mb-2">Found existing account:</p>
                    {searchResults.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => selectExistingCustomer(customer)}
                        className="w-full text-left p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#1E2A78] to-[#3B4B9A] rounded-full flex items-center justify-center text-white font-medium">
                            {customer.first_name[0]}{customer.last_name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {customer.first_name} {customer.last_name}
                            </p>
                            <p className="text-sm text-gray-600">{customer.email}</p>
                            <p className="text-sm text-blue-600">
                              {customer.total_points} points • {customer.current_tier} tier
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Additional Info */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#1E2A78] to-[#3B4B9A] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Almost There!</h2>
                <p className="text-gray-600">Help us personalize your experience</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E2A78] focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Enter your phone number"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  We'll send you exclusive offers and updates
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth (Optional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleInputChange('birthDate', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E2A78] focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  We'll send you special birthday rewards!
                </p>
              </div>
            </div>
          )}

          {/* Step 3: OTP Verification (Placeholder) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Complete!</h2>
                <p className="text-gray-600">Your account has been verified successfully</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="font-medium text-green-900 mb-1">Email Verified</p>
                <p className="text-sm text-green-700">
                  Your email {formData.email} has been successfully verified
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Ready to earn rewards!</p>
                    <p className="text-sm text-blue-700">Your loyalty account is all set up</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Trophy className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {formData.isExisting ? 'Welcome Back!' : 'You\'re All Set!'}
                </h2>
                <p className="text-gray-600">
                  {formData.isExisting 
                    ? 'Continue earning points and redeeming rewards'
                    : 'Start earning points with your first purchase'
                  }
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium text-gray-900">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">{formData.email}</span>
                </div>
                {formData.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium text-gray-900">{formData.phone}</span>
                  </div>
                )}
                {formData.birthDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Birthday:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(formData.birthDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {!formData.isExisting && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900">Welcome!</p>
                      <p className="text-sm text-green-700">Start earning points with your first purchase</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8">
            {step > 0 && !formData.isExisting && (
              <button
                onClick={handleBack}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            
            <button
              onClick={handleNext}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-[#1E2A78] to-[#3B4B9A] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {step === 0 ? 'Get Started' : 
                   step === 4 ? (
                    formData.isExisting ? 'Continue to Wallet' : 'Join Program'
                  ) : (
                    'Next'
                  )}
                  {step < 4 && step > 0 && <ArrowRight className="h-4 w-4" />}
                  {step === 0 && <ArrowRight className="h-4 w-4" />}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;