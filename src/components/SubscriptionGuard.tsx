import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Crown, AlertTriangle, Clock, CreditCard, ArrowRight,
  CheckCircle, X, Sparkles, TrendingUp, Users, Gift
} from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  requiredFeature?: 'advancedAnalytics' | 'customBranding' | 'apiAccess' | 'prioritySupport';
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children, requiredFeature }) => {
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await SubscriptionService.checkSubscriptionAccess(user.id);
      setSubscriptionData(data);

      // Check if specific feature is required and not available
      if (requiredFeature && !data.features[requiredFeature]) {
        setShowUpgradeModal(true);
      } else {
        setShowUpgradeModal(false);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      // On error, allow access to prevent lockout
      setSubscriptionData({
        hasAccess: true,
        subscription: null,
        features: {
          maxCustomers: 100,
          maxBranches: 1,
          advancedAnalytics: false,
          prioritySupport: false,
          customBranding: false,
          apiAccess: false
        },
        daysRemaining: 30
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate('/upgrade');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E6A85C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your workspace...</p>
          <p className="text-sm text-gray-500 mt-1">✨ Almost ready to serve your customers!</p>
        </div>
      </div>
    );
  }

  // Show upgrade modal if required feature is not available
  if (showUpgradeModal && requiredFeature && !subscriptionData?.features[requiredFeature]) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full border border-gray-200 shadow-xl"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
              Upgrade Required
            </h3>
            <p className="text-gray-600">
              This feature requires a paid subscription to access.
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-6">
            <h4 className="font-medium text-blue-900 mb-2">Unlock Premium Features:</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Advanced analytics & ROI tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Unlimited customers & branches
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Priority support & training
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleUpgrade}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              Upgrade Now
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show trial expiry warning
  if (subscriptionData?.hasAccess && 
      subscriptionData?.subscription?.plan_type === 'trial' && 
      subscriptionData?.daysRemaining !== undefined && 
      subscriptionData?.daysRemaining <= 7) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Trial Warning Banner */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5" />
              <span className="font-medium">
                {subscriptionData.daysRemaining > 0 
                  ? `Your trial expires in ${subscriptionData.daysRemaining} days`
                  : 'Your trial has expired'
                }
              </span>
            </div>
            <button
              onClick={handleUpgrade}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              Upgrade Now
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // Show expired subscription message only if truly expired (not just cancelled)
  if (subscriptionData && !subscriptionData.hasAccess && subscriptionData.isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full border border-gray-200 shadow-xl text-center"
        >
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
            Subscription Expired
          </h3>
          <p className="text-gray-600 mb-6">
            Your subscription has expired. Please upgrade to continue using Voya.
          </p>
          <button
            onClick={handleUpgrade}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            Renew Subscription
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  // Show cancelled but still active subscription notice
  if (subscriptionData?.isCancelled && subscriptionData?.hasAccess && !subscriptionData?.isExpired) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Cancellation Notice Banner */}
        <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                Subscription cancelled. Access continues until {new Date(subscriptionData.subscription.current_period_end).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={handleUpgrade}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              Reactivate
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
};

export default SubscriptionGuard;