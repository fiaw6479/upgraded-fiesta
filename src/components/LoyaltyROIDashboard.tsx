import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Gift, Target,
  ChevronDown, ChevronUp, Info, AlertCircle, CheckCircle,
  BarChart3, PieChart, LineChart, Repeat, ShoppingCart,
  Crown, Award, Sparkles, RefreshCw, Settings, Calculator
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart as RechartsLineChart, Line, ComposedChart, Legend
} from 'recharts';
import { LoyaltyAnalyticsService, LoyaltyROIMetrics, RevenueBreakdown, CustomerBehaviorMetrics, ROISettings } from '../services/loyaltyAnalyticsService';
import { useAuth } from '../contexts/AuthContext';

interface LoyaltyROIDashboardProps {
  timeRange: string;
}

const LoyaltyROIDashboard: React.FC<LoyaltyROIDashboardProps> = ({ timeRange }) => {
  const [metrics, setMetrics] = useState<LoyaltyROIMetrics | null>(null);
  const [revenueBreakdown, setRevenueBreakdown] = useState<RevenueBreakdown[]>([]);
  const [behaviorMetrics, setBehaviorMetrics] = useState<CustomerBehaviorMetrics | null>(null);
  const [roiSettings, setROISettings] = useState<ROISettings | null>(null);
  const [showROISettings, setShowROISettings] = useState(false);
  const [showMoreInsights, setShowMoreInsights] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  
  const { restaurant } = useAuth();

  useEffect(() => {
    if (restaurant) {
      fetchLoyaltyMetrics();
    }
  }, [restaurant, timeRange]);

  const fetchLoyaltyMetrics = async () => {
    if (!restaurant) return;

    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      startDate.setDate(startDate.getDate() - days);

      const dateRange = { start: startDate, end: endDate };

      const [metricsData, revenueData, behaviorData] = await Promise.all([
        LoyaltyAnalyticsService.getLoyaltyROIMetrics(restaurant.id, dateRange),
        LoyaltyAnalyticsService.getRevenueBreakdown(restaurant.id, dateRange),
        LoyaltyAnalyticsService.getCustomerBehaviorMetrics(restaurant.id, dateRange),
        LoyaltyAnalyticsService.getROISettings(restaurant.id)
      ]);

      setMetrics(metricsData);
      setRevenueBreakdown(revenueData);
      setBehaviorMetrics(behaviorData);
      setROISettings(roiSettings);

    } catch (err: any) {
      console.error('Error fetching loyalty metrics:', err);
      setError(err.message || 'Failed to load loyalty metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveROISettings = async () => {
    if (!restaurant || !roiSettings) return;

    try {
      setSavingSettings(true);
      await LoyaltyAnalyticsService.updateROISettings(restaurant.id, roiSettings);
      await fetchLoyaltyMetrics(); // Refresh metrics with new settings
    } catch (error) {
      console.error('Error saving ROI settings:', error);
    } finally {
      setSavingSettings(false);
      setShowROISettings(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getROIBadge = (status: string) => {
    switch (status) {
      case 'high-performing':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          text: 'High Performing'
        };
      case 'profitable':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: TrendingUp,
          text: 'Profitable'
        };
      case 'losing-money':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: AlertCircle,
          text: 'Losing Money'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Info,
          text: 'No Data'
        };
    }
  };

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 h-64 bg-gray-200 rounded-2xl"></div>
            <div className="h-64 bg-gray-200 rounded-2xl"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to Load Loyalty Metrics</h3>
        <p className="text-red-700 mb-4">{error || 'Unknown error occurred'}</p>
        <button
          onClick={fetchLoyaltyMetrics}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  const roiBadge = getROIBadge(metrics.roiStatus);
  const BadgeIcon = roiBadge.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Loyalty Program ROI</h2>
          <p className="text-gray-600">
            Financial impact and return on investment analysis
            {restaurant?.settings?.loyaltyMode && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {restaurant.settings.loyaltyMode === 'blanket' ? 'Blanket Mode' : 'Menu-Based Mode'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLoyaltyMetrics}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowROISettings(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="ROI Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Primary ROI Card */}
      <div className="bg-gradient-to-br from-[#1E2A78] to-[#3B4B9A] rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-white/80 mb-2">Loyalty Program ROI</h3>
              <div className="flex items-center gap-4">
                <span className="text-5xl font-bold">{formatPercentage(metrics.roi)}</span>
                <div className={`px-3 py-1 rounded-full border ${roiBadge.color.replace('text-', 'text-white ').replace('bg-', 'bg-white/20 ').replace('border-', 'border-white/30 ')}`}>
                  <div className="flex items-center gap-2">
                    <BadgeIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">{roiBadge.text}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-2">
                <TrendingUp className="h-8 w-8" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-white/90 text-sm leading-relaxed">
              {metrics.roiSummaryText}
              {restaurant?.settings && (
                <span className="block mt-2 text-white/70 text-xs">
                  Point System: 1 point = {restaurant.settings.pointValueAED || 0.05} AED • 
                  Earning Rate: {restaurant.settings.pointsPerAED || 0.1} points per AED
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Gross Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.grossRevenue)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Total sales before redemptions</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Calculator className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Estimated Gross Profit</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.estimatedGrossProfit)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">Profit Margin:</p>
            <span className="text-xs font-medium text-blue-600">
              {metrics.profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <Gift className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Reward Cost</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.rewardCost)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">{metrics.totalPointsRedeemed.toLocaleString()} points redeemed</p>
            <p className="text-xs text-gray-500">
              {metrics.rewardCostPercentage.toFixed(1)}% of revenue
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Net Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.netRevenue)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Revenue after redemptions</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Net Profit</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.netProfit)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Final profit after all costs</p>
        </div>
      </div>

      {/* Revenue Breakdown Chart */}
      {revenueBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Revenue Breakdown</h3>
              <p className="text-sm text-gray-500">Monthly revenue and profit trends</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600">Gross Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-600">Reward Cost</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600">Net Profit</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  className="text-sm text-gray-500"
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  className="text-sm text-gray-500"
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={renderCustomTooltip} />
                <Bar 
                  dataKey="grossRevenue" 
                  fill="#10B981" 
                  radius={[4, 4, 0, 0]}
                  name="Gross Revenue"
                />
                <Bar 
                  dataKey="rewardCost" 
                  fill="#EF4444" 
                  radius={[4, 4, 0, 0]}
                  name="Reward Cost"
                />
                <Line 
                  type="monotone" 
                  dataKey="netProfit" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  name="Net Profit"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Points Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Points Issued</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalPointsIssued.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">All points given to customers</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Gift className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Points Redeemed</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalPointsRedeemed.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Points used for rewards</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Reward Liability</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalRewardLiability)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Value of unused points</p>
        </div>
      </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <Repeat className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Point Redemption Rate</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.pointRedemptionRate.toFixed(1)}%</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Points redeemed vs issued</p>
        </div>

      {/* More Insights Toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowMoreInsights(!showMoreInsights)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-gray-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">More Insights</h3>
              <p className="text-sm text-gray-500">Customer behavior and advanced metrics</p>
            </div>
          </div>
          {showMoreInsights ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {showMoreInsights && behaviorMetrics && (
          <div className="border-t border-gray-200 p-6 space-y-6">
            {/* Behavioral KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Repeat className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900">Repeat Purchase Rate</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(metrics.repeatPurchaseRate)}</p>
                <p className="text-xs text-gray-500">Customers with multiple visits</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingCart className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-gray-900">Average Order Value</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.averageOrderValue)}</p>
                <p className="text-xs text-gray-500">Average spend per order</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-gray-900">Loyalty AOV</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.loyaltyAOV)}</p>
                <p className="text-xs text-gray-500">AOV for loyalty customers</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium text-gray-900">Customer Lifetime Value</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.customerLifetimeValue)}</p>
                <p className="text-xs text-gray-500">Estimated LTV per customer</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Award className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-gray-900">Purchase Frequency</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{metrics.purchaseFrequency.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Orders per customer per month</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-gray-900">Loyalty Participation</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(behaviorMetrics.loyaltyParticipation)}</p>
                <p className="text-xs text-gray-500">Customers in loyalty program</p>
              </div>
            </div>

            {/* Customer Breakdown Table */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-medium text-gray-900 mb-4">Customer Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{behaviorMetrics.newCustomers}</p>
                  <p className="text-sm text-gray-600">New Customers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{behaviorMetrics.returningCustomers}</p>
                  <p className="text-sm text-gray-600">Returning Customers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{behaviorMetrics.averagePointsEarned.toFixed(0)}</p>
                  <p className="text-sm text-gray-600">Avg Points Earned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{behaviorMetrics.averagePointsRedeemed.toFixed(0)}</p>
                  <p className="text-sm text-gray-600">Avg Points Redeemed</p>
                </div>
              </div>
              
              {/* Point System Information */}
              {restaurant?.settings && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Current Point System Configuration</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-blue-700">
                    <div>
                      <span className="font-medium">Mode:</span> {restaurant.settings.loyaltyMode === 'blanket' ? 'Blanket' : 'Menu-Based'}
                    </div>
                    <div>
                      <span className="font-medium">Point Value:</span> 1 point = {restaurant.settings.pointValueAED || 0.05} AED
                    </div>
                    <div>
                      <span className="font-medium">Earning Rate:</span> {restaurant.settings.pointsPerAED || 0.1} points per AED
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ROI Settings Modal */}
      {showROISettings && roiSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">ROI Calculation Settings</h3>
              <button
                onClick={() => setShowROISettings(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">About ROI Calculations</span>
                </div>
                <p className="text-xs text-blue-700">
                  These settings help estimate profitability when exact cost data isn't available. 
                  Adjust based on your restaurant's actual margins. Current point system: 1 point = {restaurant?.settings?.pointValueAED || 0.05} AED
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Profit Margin (%)
                </label>
                <input
                  type="number"
                  value={(roiSettings.default_profit_margin * 100).toFixed(0)}
                  onChange={(e) => setROISettings({
                    ...roiSettings,
                    default_profit_margin: parseFloat(e.target.value) / 100 || 0.3
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1E2A78] focus:border-transparent"
                  min="10"
                  max="80"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used when menu item cost prices aren't available
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated COGS (%)
                </label>
                <input
                  type="number"
                  value={(roiSettings.estimated_cogs_percentage * 100).toFixed(0)}
                  onChange={(e) => setROISettings({
                    ...roiSettings,
                    estimated_cogs_percentage: parseFloat(e.target.value) / 100 || 0.4
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1E2A78] focus:border-transparent"
                  min="20"
                  max="70"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cost of goods sold as percentage of revenue
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target ROI (%)
                </label>
                <input
                  type="number"
                  value={roiSettings.target_roi_percentage.toFixed(0)}
                  onChange={(e) => setROISettings({
                    ...roiSettings,
                    target_roi_percentage: parseFloat(e.target.value) || 200
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1E2A78] focus:border-transparent"
                  min="50"
                  max="500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your target return on loyalty investment
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowROISettings(false)}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveROISettings}
                disabled={savingSettings}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#1E2A78] to-[#3B4B9A] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingSettings ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyROIDashboard;