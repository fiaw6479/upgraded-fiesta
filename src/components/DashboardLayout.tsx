import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { SubscriptionService } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import {
  Home,
  Users,
  Gift,
  Settings,
  LogOut,
  Menu,
  X,
  ChefHat,
  MapPin,
  HeadphonesIcon,
  Wallet,
  BarChart3,
  Crown,
  Clock,
  ArrowRight,
  CreditCard
} from 'lucide-react';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [lastSubscriptionCheck, setLastSubscriptionCheck] = useState<number>(0);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  React.useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  // Listen for subscription updates from payments
  React.useEffect(() => {
    const handleSubscriptionUpdate = () => {
      console.log('🔄 Subscription update event received, refreshing...');
      checkSubscription(true);
      setShowUpgradeSuccess(true);
      setTimeout(() => setShowUpgradeSuccess(false), 5000);
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, []);

  // Check for payment success in URL and refresh subscription
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      console.log('🎉 Payment success detected, refreshing subscription...');
      // Clean up URL immediately to prevent re-triggering
      window.history.replaceState({}, '', window.location.pathname);
      
      // Trigger immediate subscription refresh and set up polling
      checkSubscription(true);
      
      // Set up polling to check for subscription updates
      let pollCount = 0;
      const maxPolls = 20; // Poll for up to 2 minutes
      const pollInterval = setInterval(() => {
        pollCount++;
        console.log(`🔄 Polling for subscription update (${pollCount}/${maxPolls})`);
        
        checkSubscription(true);
        
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          console.log('⏰ Stopped polling for subscription updates');
        }
      }, 6000); // Poll every 6 seconds
      
      // Also trigger the subscription update event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      }, 1000);
      
      // Clean up polling when component unmounts
      return () => {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      };
    }
  }, []);

  const checkSubscription = async (forceRefresh: boolean = false) => {
    if (!user) return;
    
    // Check if we should use cached subscription data (15 minute cache)
    const now = Date.now();
    const SUBSCRIPTION_CACHE_DURATION = 5 * 1000; // Reduced to 5 seconds for immediate payment updates
    
    if (!forceRefresh && subscriptionData && (now - lastSubscriptionCheck) < SUBSCRIPTION_CACHE_DURATION) {
      console.log('📊 Using cached subscription data');
      return;
    }
    
    try {
      setSubscriptionLoading(true);
      console.log('🔄 Fetching fresh subscription data...', forceRefresh ? '(forced)' : '(cache expired)');
      const data = await SubscriptionService.checkSubscriptionAccess(user.id);
      console.log('📊 Subscription data loaded:', {
        hasAccess: data.hasAccess,
        planType: data.subscription?.plan_type,
        status: data.subscription?.status,
        daysRemaining: data.daysRemaining,
        billingPeriodText: data.billingPeriodText,
        billingPeriodAccurate: data.billingPeriodAccurate
      });
      setSubscriptionData(data);
      setLastSubscriptionCheck(now);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Menu Items', href: '/dashboard/menu-items', icon: ChefHat },
    { name: 'Rewards', href: '/dashboard/rewards', icon: Gift },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Branches', href: '/dashboard/branches', icon: MapPin },
    { name: 'Loyalty Config', href: '/dashboard/loyalty-config', icon: Settings },
    { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Support', href: '/dashboard/support', icon: HeadphonesIcon },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname === href;
  };

  // Add debug info for subscription status
  React.useEffect(() => {
    if (subscriptionData) {
      console.log('🔍 Current subscription status in layout:', {
        planType: subscriptionData.subscription?.plan_type,
        status: subscriptionData.subscription?.status,
        hasAccess: subscriptionData.hasAccess,
        isExpired: subscriptionData.isExpired,
        daysRemaining: subscriptionData.daysRemaining
      });
    }
  }, [subscriptionData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <img src="/image.png" alt="VOYA" className="h-8 w-auto object-contain" />
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm">
          <div className="flex h-16 items-center px-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <img src="/image.png" alt="VOYA" className="h-10 w-auto object-contain" />
            </div>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-200">
            {/* Subscription Status */}
            {subscriptionData && (
              <div className="mb-4">
                {subscriptionData.subscription?.plan_type === 'trial' && subscriptionData.daysRemaining !== undefined && subscriptionData.daysRemaining <= 7 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-900">
                        Trial expires in {subscriptionData.daysRemaining} days
                      </span>
                    </div>
                    <button
                      onClick={() => navigate('/upgrade')}
                      className="w-full bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white px-3 py-2 rounded-lg text-sm font-medium hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Crown className="h-4 w-4" />
                      Upgrade Now
                    </button>
                  </div>
                )}
                
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Current Plan</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      subscriptionData.subscription?.plan_type === 'trial' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {subscriptionData.subscription?.plan_type || 'Trial'}
                    </span>
                  </div>
                  {subscriptionData.subscription?.status && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Status</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        subscriptionData.subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                        subscriptionData.subscription.status === 'past_due' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {subscriptionData.subscription.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500">Restaurant Owner</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => navigate('/wallet')}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mb-2"
            >
              <Wallet className="w-5 h-5 mr-3" />
              Customer Wallet
            </button>
            {subscriptionData?.subscription?.plan_type === 'trial' && (
              <button
                onClick={() => navigate('/upgrade')}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] rounded-lg transition-colors mb-2 hover:shadow-md"
              >
                <Crown className="w-5 h-5 mr-3" />
                Upgrade Plan
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Subscription indicator for mobile */}
              {subscriptionData?.subscription?.plan_type === 'trial' && subscriptionData?.daysRemaining !== undefined && subscriptionData?.daysRemaining <= 7 && (
                <button
                  onClick={() => navigate('/upgrade')}
                  className="lg:hidden bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" />
                  {subscriptionData.daysRemaining}d left
                </button>
              )}
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.email}
                  </p>
                  <p className="text-xs text-gray-500">Restaurant Owner</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}