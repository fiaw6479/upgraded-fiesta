import { useState, useEffect, useCallback } from 'react';
import { CustomerService } from '../services/customerService';
import { RewardService } from '../services/rewardService';
import { SubscriptionService } from '../services/subscriptionService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Cache for dashboard data with timestamps
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const TAB_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for tab switching
const lastFetchTimes = new Map<string, number>();

interface DashboardStats {
  name: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  description: string;
}

interface RecentActivity {
  id: string;
  customer: string;
  avatar: string;
  action: string;
  points: string;
  time: string;
  tier: 'bronze' | 'silver' | 'gold';
  reward?: string;
}

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
  time: string;
}

interface CustomerGrowthData {
  date: string;
  newCustomers: number;
  returningCustomers: number;
  totalCustomers: number;
}

interface RewardDistributionData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

interface LoyaltyROIData {
  totalRevenue: number;
  loyaltyRevenue: number;
  rewardCosts: number;
  netProfit: number;
  roi: number;
  averageOrderValue: number;
  loyaltyAOV: number;
  retentionRate: number;
}

interface MonthlyTrendData {
  month: string;
  revenue: number;
  loyaltyRevenue: number;
  rewardCosts: number;
  netProfit: number;
}

export const useDashboardData = (timeRange: string = '7d') => {
  const [stats, setStats] = useState<DashboardStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [customerGrowthData, setCustomerGrowthData] = useState<CustomerGrowthData[]>([]);
  const [rewardDistribution, setRewardDistribution] = useState<RewardDistributionData[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
  const [loyaltyROI, setLoyaltyROI] = useState<LoyaltyROIData | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrendData[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, restaurant } = useAuth();

  // Track last fetch times for each tab
  const [lastFetchTimes, setLastFetchTimes] = useState<Map<string, number>>(new Map());
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  // Check if we should use cached data (for tab switching)
  const shouldUseCachedData = (cacheKey: string) => {
    const cached = dataCache.get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < CACHE_DURATION;
  };

  // Store data in cache
  const setCachedData = (cacheKey: string, data: any) => {
    dataCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  };

  // Get cached data
  const getCachedData = (cacheKey: string) => {
    const cached = dataCache.get(cacheKey);
    return cached?.data;
  };

  const currentUser = {
    name: user?.user_metadata?.first_name && user?.user_metadata?.last_name 
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : user?.email?.split('@')[0] || 'User',
    role: 'Restaurant Owner',
    avatar: user?.user_metadata?.first_name?.[0]?.toUpperCase() || 'U'
  };

  const fetchCustomerGrowthData = async (restaurantId: string) => {
    try {
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data: customers, error } = await supabase
        .from('customers')
        .select('created_at, visit_count')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Group customers by date
      const growthMap = new Map<string, { new: number; returning: number; total: number }>();
      
      for (let i = 0; i < daysBack; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        growthMap.set(dateStr, { new: 0, returning: 0, total: 0 });
      }

      customers.forEach(customer => {
        const dateStr = customer.created_at.split('T')[0];
        const data = growthMap.get(dateStr);
        if (data) {
          data.new += 1;
          data.total += 1;
          if (customer.visit_count > 1) {
            data.returning += 1;
          }
        }
      });

      const growthData: CustomerGrowthData[] = Array.from(growthMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          newCustomers: data.new,
          returningCustomers: data.returning,
          totalCustomers: data.total
        }))
        .reverse();

      return growthData;
    } catch (error) {
      console.error('Error fetching customer growth data:', error);
      return [];
    }
  };

  const fetchRewardDistribution = async (restaurantId: string) => {
    try {
      const { data: rewards, error } = await supabase
        .from('rewards')
        .select('category, total_redeemed')
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      const categoryMap = new Map<string, number>();
      rewards.forEach(reward => {
        const current = categoryMap.get(reward.category) || 0;
        categoryMap.set(reward.category, current + reward.total_redeemed);
      });

      const total = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0);
      const colors = ['#1E2A78', '#3B4B9A', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B'];
      
      const distributionData: RewardDistributionData[] = Array.from(categoryMap.entries())
        .map(([category, value], index) => ({
          name: category.charAt(0).toUpperCase() + category.slice(1),
          value,
          color: colors[index % colors.length],
          percentage: total > 0 ? Math.round((value / total) * 100) : 0
        }))
        .filter(item => item.value > 0);

      return distributionData;
    } catch (error) {
      console.error('Error fetching reward distribution:', error);
      return [];
    }
  };

  const fetchLoyaltyROI = async (restaurantId: string) => {
    try {
      // Get customer spending data
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('total_spent, visit_count, total_points, lifetime_points')
        .eq('restaurant_id', restaurantId);

      if (customersError) throw customersError;

      // Get reward redemption costs
      const { data: redemptions, error: redemptionsError } = await supabase
        .from('reward_redemptions')
        .select('points_used')
        .eq('restaurant_id', restaurantId);

      if (redemptionsError) throw redemptionsError;

      // Get restaurant settings for point value calculation
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .maybeSingle();

      if (restaurantError) throw restaurantError;

      const pointsPerDollar = restaurantData.settings?.points_per_dollar || 1;
      const pointValue = 1 / pointsPerDollar; // Each point is worth this much in dollars

      // Calculate metrics
      const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_spent.toString()), 0);
      const loyaltyCustomers = customers.filter(c => c.visit_count > 1);
      const loyaltyRevenue = loyaltyCustomers.reduce((sum, c) => sum + parseFloat(c.total_spent.toString()), 0);
      
      const totalRewardCosts = redemptions.reduce((sum, r) => sum + (r.points_used * pointValue), 0);
      const netProfit = loyaltyRevenue - totalRewardCosts;
      const roi = loyaltyRevenue > 0 ? ((netProfit / totalRewardCosts) * 100) : 0;
      
      const averageOrderValue = customers.length > 0 ? totalRevenue / customers.reduce((sum, c) => sum + c.visit_count, 0) : 0;
      const loyaltyAOV = loyaltyCustomers.length > 0 ? loyaltyRevenue / loyaltyCustomers.reduce((sum, c) => sum + c.visit_count, 0) : 0;
      const retentionRate = customers.length > 0 ? (loyaltyCustomers.length / customers.length) * 100 : 0;

      return {
        totalRevenue,
        loyaltyRevenue,
        rewardCosts: totalRewardCosts,
        netProfit,
        roi,
        averageOrderValue,
        loyaltyAOV,
        retentionRate
      };
    } catch (error) {
      console.error('Error fetching loyalty ROI:', error);
      return null;
    }
  };

  const fetchMonthlyTrends = async (restaurantId: string) => {
    try {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        months.push({
          start: new Date(date.getFullYear(), date.getMonth(), 1),
          end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
          name: date.toLocaleDateString('en-US', { month: 'short' })
        });
      }

      const trendsData: MonthlyTrendData[] = [];

      for (const month of months) {
        const { data: customers, error } = await supabase
          .from('customers')
          .select('total_spent, visit_count, created_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', month.start.toISOString())
          .lte('created_at', month.end.toISOString());

        if (error) throw error;

        const monthRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_spent.toString()), 0);
        const loyaltyRevenue = customers.filter(c => c.visit_count > 1).reduce((sum, c) => sum + parseFloat(c.total_spent.toString()), 0);
        
        // Estimate reward costs (simplified)
        const estimatedRewardCosts = loyaltyRevenue * 0.05; // Assume 5% of loyalty revenue goes to rewards
        const netProfit = loyaltyRevenue - estimatedRewardCosts;

        trendsData.push({
          month: month.name,
          revenue: monthRevenue,
          loyaltyRevenue,
          rewardCosts: estimatedRewardCosts,
          netProfit
        });
      }

      return trendsData;
    } catch (error) {
      console.error('Error fetching monthly trends:', error);
      return [];
    }
  };

  const fetchRecentActivity = async (restaurantId: string) => {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          *,
          customer:customers(first_name, last_name, current_tier),
          reward:rewards(name)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return transactions.map((transaction: any) => ({
        id: transaction.id,
        customer: `${transaction.customer.first_name} ${transaction.customer.last_name}`,
        avatar: `${transaction.customer.first_name[0]}${transaction.customer.last_name[0]}`,
        action: transaction.description || `${transaction.type} transaction`,
        points: transaction.points > 0 ? `+${transaction.points}` : transaction.points.toString(),
        time: new Date(transaction.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        tier: transaction.customer.current_tier,
        reward: transaction.reward?.name
      }));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  };

  const fetchDashboardData = useCallback(async (forceRefresh: boolean = false) => {
    if (!user) return;
    
    const cacheKey = `dashboard-${restaurant?.id || 'no-restaurant'}-${timeRange}`;
    
    // Check if we should use cached data (unless force refresh)
    if (!forceRefresh && shouldUseCachedData(cacheKey, true)) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setStats(cachedData.stats);
        setRecentActivity(cachedData.recentActivity);
        setCustomerGrowthData(cachedData.customerGrowthData);
        setRewardDistribution(cachedData.rewardDistribution);
        setWeeklyActivity(cachedData.weeklyActivity);
        setLoyaltyROI(cachedData.loyaltyROI);
        setMonthlyTrends(cachedData.monthlyTrends);
        setNotifications(cachedData.notifications);
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      setError(null);

      // If no restaurant, show empty state
      if (!restaurant) {
        console.log('No restaurant found, showing empty state');
        setStats([
          {
            name: 'Total Customers',
            value: '0',
            change: '+0',
            trend: 'up',
            description: 'No customers yet'
          },
          {
            name: 'Total Points Issued',
            value: '0',
            change: '+0%',
            trend: 'up',
            description: 'All points given to customers'
          },
          {
            name: 'Rewards Claimed',
            value: '0',
            change: '+0%',
            trend: 'up',
            description: 'vs last month'
          },
          {
            name: 'Revenue Impact',
            value: '$0',
            change: '+0%',
            trend: 'up',
            description: 'Total customer value'
          }
        ]);
        
        setRecentActivity([]);
        setCustomerGrowthData([]);
        setRewardDistribution([]);
        setWeeklyActivity([]);
        setLoyaltyROI(null);
        setMonthlyTrends([]);
        setNotifications([
          {
            id: '1',
            type: 'info',
            title: 'Welcome to TableLoyalty!',
            message: 'Start by creating your first customer or reward',
            time: 'Just now'
          }
        ]);
        
        setLoading(false);
        return;
      }

      // Fetch real customer and reward stats with increased timeout
      const [
        customerStats, 
        rewardStats, 
        growthData, 
        distributionData, 
        roiData, 
        trendsData, 
        activityData
      ] = await Promise.all([
        Promise.race([
          CustomerService.getCustomerStats(restaurant.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Customer stats timeout')), 15000) // Increased timeout
          )
        ]),
        Promise.race([
          RewardService.getRewardStats(restaurant.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Reward stats timeout')), 15000) // Increased timeout
          )
        ]),
        fetchCustomerGrowthData(restaurant.id),
        fetchRewardDistribution(restaurant.id),
        fetchLoyaltyROI(restaurant.id),
        fetchMonthlyTrends(restaurant.id),
        fetchRecentActivity(restaurant.id)
      ]);

      // Calculate total points issued (not just current balance)
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select('points')
        .eq('restaurant_id', restaurant.id)
        .gt('points', 0); // Only positive point transactions (issued points)
      
      const totalPointsIssued = allTransactions?.reduce((sum, t) => sum + t.points, 0) || 0;
      // Generate real stats from database
      const dashboardStats: DashboardStats[] = [
        {
          name: 'Total Customers',
          value: (customerStats as any).totalCustomers.toString(),
          change: `+${(customerStats as any).newThisMonth}`,
          trend: 'up',
          description: 'New this month'
        },
        {
          name: 'Total Points Issued',
          value: totalPointsIssued.toLocaleString(),
          change: '+0%',
          trend: 'up',
          description: 'All points given to customers'
        },
        {
          name: 'Rewards Claimed',
          value: (rewardStats as any).totalRedemptions.toString(),
          change: '+0%',
          trend: 'up',
          description: 'vs last month'
        },
        {
          name: 'Revenue Impact',
          value: `$${((customerStats as any).averageSpent * (customerStats as any).totalCustomers).toFixed(0)}`,
          change: '+0%',
          trend: 'up',
          description: 'Total customer value'
        }
      ];

      setStats(dashboardStats);
      setCustomerGrowthData(growthData);
      setRewardDistribution(distributionData);
      setWeeklyActivity([]);
      setLoyaltyROI(roiData);
      setMonthlyTrends(trendsData);
      setRecentActivity(activityData);
      setNotifications([]);

      // Cache the data
      setCachedData(cacheKey, {
        stats: dashboardStats,
        recentActivity: activityData,
        customerGrowthData: growthData,
        rewardDistribution: distributionData,
        weeklyActivity: [],
        loyaltyROI: roiData,
        monthlyTrends: trendsData,
        notifications: []
      });

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [restaurant]);

  const refreshData = useCallback(() => {
    fetchDashboardData(true); // Force refresh
  }, [fetchDashboardData]);

  // Add subscription refresh function
  const refreshSubscription = useCallback(async () => {
    if (user) {
      try {
        // Force refresh subscription data
        const subscriptionData = await SubscriptionService.checkSubscriptionAccess(user.id);
        console.log('🔄 Subscription refreshed:', subscriptionData);
        
        // Trigger a re-render by updating a timestamp or similar
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      } catch (error) {
        console.error('Error refreshing subscription:', error);
      }
    }
  }, [user]);

  useEffect(() => {
    // Check if we have valid cached data first
    const cacheKey = `dashboard-${restaurant?.id || 'no-restaurant'}-${timeRange}`;
    
    if (user && shouldUseCachedData(cacheKey, true)) {
      // Load from cache immediately for tab switching
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setStats(cachedData.stats);
        setRecentActivity(cachedData.recentActivity);
        setCustomerGrowthData(cachedData.customerGrowthData);
        setRewardDistribution(cachedData.rewardDistribution);
        setWeeklyActivity(cachedData.weeklyActivity);
        setLoyaltyROI(cachedData.loyaltyROI);
        setMonthlyTrends(cachedData.monthlyTrends);
        setNotifications(cachedData.notifications);
        setLoading(false);
        console.log('📊 Dashboard data loaded from cache (tab switch)');
        return;
      }
    }
    
    // Fetch fresh data if no valid cache
    if (user) {
      console.log('📊 Fetching fresh dashboard data...');
      fetchDashboardData();
    }
  }, [user, restaurant, timeRange, fetchDashboardData]);

  // Listen for subscription updates
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      console.log('🔄 Subscription update event received in dashboard');
      // Immediately refresh data when subscription updates
      refreshData();
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    
    return () => {
      window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
    };
  }, [refreshData]);

  return {
    stats,
    recentActivity,
    customerGrowthData,
    rewardDistribution,
    weeklyActivity,
    loyaltyROI,
    monthlyTrends,
    notifications,
    currentUser,
    loading,
    error,
    refreshData,
    refreshSubscription
  };
};