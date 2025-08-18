import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Gift, Clock, User, QrCode, ArrowRight, 
  Crown, Award, ChefHat, Star, Sparkles, TrendingUp,
  Bell, Menu, X, Eye, EyeOff, Mail, Phone, Calendar,
  UserPlus, Shield, CheckCircle, AlertCircle, Loader2,
  Search, Copy, Share2, MapPin, Building
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomerService } from '../services/customerService';
import { RewardService } from '../services/rewardService';
import CustomerOnboarding from './CustomerOnboarding';
import CustomerRedemptionModal from './CustomerRedemptionModal';

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
  current_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  tier_progress: number;
  visit_count: number;
  total_spent: number;
  last_visit?: string;
  created_at: string;
}

interface Reward {
  id: string;
  name: string;
  description?: string;
  points_required: number;
  category: string;
  image_url?: string;
  min_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  is_active: boolean;
  total_available?: number;
  total_redeemed: number;
}

interface Transaction {
  id: string;
  type: 'purchase' | 'bonus' | 'referral' | 'signup' | 'redemption';
  points: number;
  amount_spent?: number;
  description?: string;
  created_at: string;
  reward?: { name: string };
}

interface CustomerWalletProps {
  isDemo?: boolean;
  onClose?: () => void;
}

const CustomerWallet: React.FC<CustomerWalletProps> = ({ isDemo = false, onClose }) => {
  const { restaurantSlug } = useParams();
  const navigate = useNavigate();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'rewards' | 'history' | 'profile'>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  

  useEffect(() => {
    loadRestaurantData();
  }, [restaurantSlug, isDemo]);

  const loadRestaurantData = async () => {
    try {
      setLoading(true);
      
      // If no slug provided, try to get the first restaurant from the database
      let restaurantData;
      if (restaurantSlug) {
        const { data, error: restaurantError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('slug', restaurantSlug)
          .single();

        if (restaurantError || !data) {
          setError('Restaurant not found');
          return;
        }
        restaurantData = data;
      } else {
        // Get the first restaurant for demo purposes
        const { data, error: restaurantError } = await supabase
          .from('restaurants')
          .select('*')
          .limit(1)
          .single();

        if (restaurantError || !data) {
          setError('No restaurant found');
          return;
        }
        restaurantData = data;
      }

      setRestaurant(restaurantData);
      setShowOnboarding(true);
    } catch (err: any) {
      console.error('Error loading restaurant:', err);
      setError('Failed to load restaurant data');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async (customerData: Customer) => {
    try {
      setCustomer(customerData);
      setShowOnboarding(false);
      
      if (restaurant) {
        const [rewardsData, transactionsData] = await Promise.all([
          RewardService.getAvailableRewards(restaurant.id, customerData.id),
          CustomerService.getCustomerTransactions(restaurant.id, customerData.id)
        ]);
        
        setRewards(rewardsData);
        setTransactions(transactionsData);
      }
    } catch (err: any) {
      console.error('Error completing onboarding:', err);
      setError('Failed to load customer data');
    }
  };

  const handleRewardRedeem = async () => {
    if (!selectedReward || !customer || !restaurant) return;

    try {
      await RewardService.redeemReward(restaurant.id, customer.id, selectedReward.id);
      
      // Refresh customer data to get updated points
      const updatedCustomer = await CustomerService.getCustomerByEmail(restaurant.id, customer.email);
      if (updatedCustomer) {
        setCustomer(updatedCustomer);
      }
      
      // Refresh rewards and transactions
      const [updatedRewards, updatedTransactions] = await Promise.all([
        RewardService.getAvailableRewards(restaurant.id, customer.id),
        CustomerService.getCustomerTransactions(restaurant.id, customer.id)
      ]);
      
      setRewards(updatedRewards);
      setTransactions(updatedTransactions);
      setSelectedReward(null);
      setShowRedemptionModal(false);
    } catch (err: any) {
      console.error('Error redeeming reward:', err);
      throw err;
    }
  };

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'platinum':
        return { 
          name: 'Platinum', 
          icon: Sparkles, 
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          nextTier: null,
          threshold: 2000
        };
      case 'gold':
        return { 
          name: 'Gold', 
          icon: Crown, 
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          nextTier: 'Platinum',
          threshold: 1000
        };
      case 'silver':
        return { 
          name: 'Silver', 
          icon: Award, 
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          nextTier: 'Gold',
          threshold: 500
        };
      default:
        return { 
          name: 'Bronze', 
          icon: ChefHat, 
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          nextTier: 'Silver',
          threshold: 0
        };
    }
  };

  const getNextTierProgress = () => {
    if (!customer) return { progress: 0, pointsNeeded: 0, nextTier: 'Silver' };
    
    const tierInfo = getTierInfo(customer.current_tier);
    let nextThreshold = 0;
    
    switch (customer.current_tier) {
      case 'bronze':
        nextThreshold = 500;
        break;
      case 'silver':
        nextThreshold = 1000;
        break;
      case 'gold':
        nextThreshold = 2000;
        break;
      default:
        return { progress: 100, pointsNeeded: 0, nextTier: null };
    }
    
    const progress = Math.min((customer.lifetime_points / nextThreshold) * 100, 100);
    const pointsNeeded = Math.max(nextThreshold - customer.lifetime_points, 0);
    
    return { progress, pointsNeeded, nextTier: tierInfo.nextTier };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (showOnboarding && restaurant) {
    return (
      <CustomerOnboarding
        restaurant={restaurant}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  if (!customer || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No customer data available</p>
        </div>
      </div>
    );
  }

  const tierInfo = getTierInfo(customer.current_tier);
  const TierIcon = tierInfo.icon;
  const nextTierProgress = getNextTierProgress();

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter',sans-serif]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img 
              src="/image.png" 
              alt="VOYA" 
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">{restaurant.name}</h1>
              <p className="text-xs text-gray-500">Loyalty Program</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg relative transition-colors"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                2
              </span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="p-4 space-y-6">
            {/* Customer Info Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {customer.first_name[0]}{customer.last_name[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">
                    {customer.first_name} {customer.last_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <TierIcon className={`h-4 w-4 ${tierInfo.color}`} />
                    <span className="text-sm font-medium text-gray-600">{tierInfo.name} Member</span>
                  </div>
                </div>
              </div>

              {/* Tier Progress */}
              <div className={`${tierInfo.bgColor} ${tierInfo.borderColor} border rounded-xl p-4 mb-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Tier Progress</span>
                  {nextTierProgress.nextTier && (
                    <span className="text-xs text-gray-500">
                      {nextTierProgress.pointsNeeded} points to {nextTierProgress.nextTier}
                    </span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${nextTierProgress.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{customer.lifetime_points} lifetime points</span>
                  {nextTierProgress.nextTier && (
                    <span>{nextTierProgress.progress.toFixed(0)}% complete</span>
                  )}
                </div>
              </div>

              {/* Points Display */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600">Available Points</p>
                  <p className="text-2xl font-bold text-gray-900">{customer.total_points.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Star className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold text-gray-900">{customer.total_spent}</p>
                  <p className="text-xs text-gray-500">AED</p>
                </div>
              </div>

              {/* QR Code Button */}
              <button
                onClick={() => setShowQRCode(true)}
                className="w-full bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-bold py-4 px-6 rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <QrCode className="h-5 w-5" />
                Show QR to Earn Points
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Gift className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Visits</p>
                    <p className="text-xl font-bold text-gray-900">{customer.visit_count}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Lifetime Points</p>
                    <p className="text-xl font-bold text-gray-900">{customer.lifetime_points.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Available Rewards Preview */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">Available Rewards</h3>
                <button
                  onClick={() => setActiveTab('rewards')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View All
                </button>
              </div>
              
              {rewards.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No rewards available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.slice(0, 2).map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{reward.name}</p>
                        <p className="text-sm text-gray-600">{reward.points_required} points</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedReward(reward);
                          setShowRedemptionModal(true);
                        }}
                        disabled={customer.total_points < reward.points_required}
                        className="px-4 py-2 bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white text-sm font-medium rounded-lg hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Redeem
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">Available Rewards</h2>
            
            {rewards.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
                <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rewards Available</h3>
                <p className="text-gray-500">Keep earning points to unlock amazing rewards!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rewards.map((reward) => {
                  const canRedeem = customer.total_points >= reward.points_required;
                  
                  return (
                    <div key={reward.id} className="bg-white rounded-2xl p-6 border border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg mb-2">{reward.name}</h3>
                          {reward.description && (
                            <p className="text-gray-600 mb-3">{reward.description}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-blue-600">
                              {reward.points_required} points
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                              {reward.category}
                            </span>
                          </div>
                        </div>
                        <div className="w-16 h-16 bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-xl flex items-center justify-center">
                          <Gift className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setSelectedReward(reward);
                          setShowRedemptionModal(true);
                        }}
                        disabled={!canRedeem}
                        className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                          canRedeem
                            ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white hover:shadow-lg'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {canRedeem ? 'Redeem Now' : `Need ${reward.points_required - customer.total_points} more points`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">Transaction History</h2>
            
            {transactions.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
                <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Yet</h3>
                <p className="text-gray-500">Your transaction history will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          transaction.points > 0 ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {transaction.points > 0 ? (
                            <TrendingUp className={`h-5 w-5 ${transaction.points > 0 ? 'text-green-600' : 'text-red-600'}`} />
                          ) : (
                            <Gift className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {transaction.description || `${transaction.type} transaction`}
                          </p>
                          <p className="text-sm text-gray-500">{formatDate(transaction.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${transaction.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.points > 0 ? '+' : ''}{transaction.points} pts
                        </p>
                        {transaction.amount_spent && (
                          <p className="text-sm text-gray-500">{transaction.amount_spent} AED</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="p-4 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">Profile</h2>
            
            {/* Profile Info */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {customer.first_name[0]}{customer.last_name[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">
                    {customer.first_name} {customer.last_name}
                  </h3>
                  <p className="text-gray-600">{customer.email}</p>
                  {customer.phone && (
                    <p className="text-gray-600">{customer.phone}</p>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Member Since</p>
                  <p className="font-bold text-gray-900">
                    {new Date(customer.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Total Visits</p>
                  <p className="font-bold text-gray-900">{customer.visit_count}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Lifetime Points</p>
                  <p className="font-bold text-gray-900">{customer.lifetime_points.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Total Spent</p>
                  <p className="font-bold text-gray-900">{customer.total_spent} AED</p>
                </div>
              </div>
            </div>

            {/* Tier Information */}
            <div className={`${tierInfo.bgColor} ${tierInfo.borderColor} border rounded-2xl p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <TierIcon className={`h-8 w-8 ${tierInfo.color}`} />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{tierInfo.name} Member</h3>
                  <p className="text-sm text-gray-600">
                    {nextTierProgress.nextTier 
                      ? `${nextTierProgress.pointsNeeded} points to ${nextTierProgress.nextTier}`
                      : 'Highest tier achieved!'
                    }
                  </p>
                </div>
              </div>
              
              {nextTierProgress.nextTier && (
                <div className="w-full bg-white rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] h-3 rounded-full transition-all duration-500"
                    style={{ width: `${nextTierProgress.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-around">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'rewards', icon: Gift, label: 'Rewards' },
            { id: 'history', icon: Clock, label: 'History' },
            { id: 'profile', icon: User, label: 'Profile' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 font-['Space_Grotesk',sans-serif]">Your QR Code</h3>
              <button
                onClick={() => setShowQRCode(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="text-center">
              <div className="w-48 h-48 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <QrCode className="h-24 w-24 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Show this QR code to staff to earn points with your purchase
              </p>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Customer ID</p>
                <p className="font-mono text-sm font-bold text-gray-900">{customer.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redemption Modal */}
      {showRedemptionModal && selectedReward && (
        <CustomerRedemptionModal
          reward={selectedReward}
          customer={customer}
          restaurant={restaurant}
          onConfirm={handleRewardRedeem}
          onClose={() => {
            setShowRedemptionModal(false);
            setSelectedReward(null);
          }}
        />
      )}
    </div>
  );
};

export default CustomerWallet;