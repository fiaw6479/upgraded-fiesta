import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, Eye, EyeOff, Search, Filter, 
  Gift, Crown, Award, ChefHat, Coffee, Utensils, 
  Percent, Star, Sparkles, AlertCircle, CheckCircle,
  X, Save, Upload, DollarSign, Users, TrendingUp,
  MoreVertical, Copy, Settings, Target, Zap
} from 'lucide-react';
import { RewardService } from '../services/rewardService';
import { useAuth } from '../contexts/AuthContext';

interface Reward {
  id: string;
  name: string;
  description?: string;
  points_required: number;
  category: string;
  image_url?: string;
  min_tier: 'bronze' | 'silver' | 'gold';
  is_active: boolean;
  total_available?: number;
  total_redeemed: number;
  created_at: string;
  updated_at: string;
}

interface RewardFormData {
  name: string;
  description: string;
  points_required: number;
  category: string;
  min_tier: 'bronze' | 'silver' | 'gold';
  is_active: boolean;
  total_available?: number;
}

const RewardsPage: React.FC = () => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState<RewardFormData>({
    name: '',
    description: '',
    points_required: 100,
    category: 'food',
    min_tier: 'bronze',
    is_active: true,
    total_available: undefined
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { restaurant } = useAuth();

  const categories = [
    { value: 'food', label: 'Food', icon: Utensils, color: 'bg-orange-100 text-orange-600' },
    { value: 'beverage', label: 'Beverage', icon: Coffee, color: 'bg-blue-100 text-blue-600' },
    { value: 'discount', label: 'Discount', icon: Percent, color: 'bg-green-100 text-green-600' },
    { value: 'experience', label: 'Experience', icon: Star, color: 'bg-purple-100 text-purple-600' },
    { value: 'merchandise', label: 'Merchandise', icon: Gift, color: 'bg-pink-100 text-pink-600' }
  ];

  const tiers = [
    { value: 'bronze', label: 'Bronze', icon: ChefHat, color: 'bg-orange-100 text-orange-600' },
    { value: 'silver', label: 'Silver', icon: Award, color: 'bg-gray-100 text-gray-600' },
    { value: 'gold', label: 'Gold', icon: Crown, color: 'bg-yellow-100 text-yellow-600' }
  ];

  useEffect(() => {
    if (restaurant) {
      fetchRewards();
    }
  }, [restaurant]);

  const fetchRewards = async () => {
    if (!restaurant) return;
    
    try {
      setLoading(true);
      setError(null);
      const rewardsData = await RewardService.getRewards(restaurant.id);
      setRewards(rewardsData);
    } catch (err: any) {
      console.error('Error fetching rewards:', err);
      setError(err.message || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReward = async () => {
    if (!restaurant) return;

    try {
      setFormLoading(true);
      setFormError('');

      if (!formData.name.trim()) {
        setFormError('Reward name is required');
        return;
      }

      if (formData.points_required <= 0) {
        setFormError('Points required must be greater than 0');
        return;
      }

      await RewardService.createReward(restaurant.id, {
        ...formData,
        total_available: formData.total_available || undefined
      });

      await fetchRewards();
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      console.error('Error creating reward:', err);
      setFormError(err.message || 'Failed to create reward');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateReward = async () => {
    if (!restaurant || !editingReward) return;

    try {
      setFormLoading(true);
      setFormError('');

      if (!formData.name.trim()) {
        setFormError('Reward name is required');
        return;
      }

      if (formData.points_required <= 0) {
        setFormError('Points required must be greater than 0');
        return;
      }

      await RewardService.updateReward(restaurant.id, editingReward.id, {
        ...formData,
        total_available: formData.total_available || undefined
      });

      await fetchRewards();
      setEditingReward(null);
      resetForm();
    } catch (err: any) {
      console.error('Error updating reward:', err);
      setFormError(err.message || 'Failed to update reward');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteReward = async (rewardId: string) => {
    if (!restaurant) return;

    if (!confirm('Are you sure you want to delete this reward? This action cannot be undone.')) {
      return;
    }

    try {
      await RewardService.deleteReward(restaurant.id, rewardId);
      await fetchRewards();
    } catch (err: any) {
      console.error('Error deleting reward:', err);
      alert(err.message || 'Failed to delete reward');
    }
  };

  const handleToggleActive = async (reward: Reward) => {
    if (!restaurant) return;

    try {
      await RewardService.updateReward(restaurant.id, reward.id, {
        is_active: !reward.is_active
      });
      await fetchRewards();
    } catch (err: any) {
      console.error('Error toggling reward status:', err);
      alert(err.message || 'Failed to update reward status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      points_required: 100,
      category: 'food',
      min_tier: 'bronze',
      is_active: true,
      total_available: undefined
    });
    setFormError('');
  };

  const openEditModal = (reward: Reward) => {
    setEditingReward(reward);
    setFormData({
      name: reward.name,
      description: reward.description || '',
      points_required: reward.points_required,
      category: reward.category,
      min_tier: reward.min_tier,
      is_active: reward.is_active,
      total_available: reward.total_available
    });
    setFormError('');
  };

  const filteredRewards = rewards.filter(reward => {
    const matchesSearch = reward.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         reward.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || reward.category === filterCategory;
    const matchesTier = filterTier === 'all' || reward.min_tier === filterTier;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && reward.is_active) ||
                         (filterStatus === 'inactive' && !reward.is_active);

    return matchesSearch && matchesCategory && matchesTier && matchesStatus;
  });

  const getCategoryInfo = (category: string) => {
    return categories.find(c => c.value === category) || categories[0];
  };

  const getTierInfo = (tier: string) => {
    return tiers.find(t => t.value === tier) || tiers[0];
  };

  const getRewardStats = () => {
    const totalRewards = rewards.length;
    const activeRewards = rewards.filter(r => r.is_active).length;
    const totalRedemptions = rewards.reduce((sum, r) => sum + r.total_redeemed, 0);
    const totalPointsRedeemed = rewards.reduce((sum, r) => sum + (r.total_redeemed * r.points_required), 0);

    return { totalRewards, activeRewards, totalRedemptions, totalPointsRedeemed };
  };

  const stats = getRewardStats();

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Rewards</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchRewards}
            className="px-6 py-3 bg-[#1E2A78] text-white rounded-lg hover:bg-[#3B4B9A] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rewards Management</h1>
          <p className="text-gray-600 mt-1">Create and manage rewards for your loyalty program</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Create Reward
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Gift className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Rewards</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRewards}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Rewards</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeRewards}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Redemptions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRedemptions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Points Redeemed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPointsRedeemed.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search rewards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>

            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
            >
              <option value="all">All Tiers</option>
              {tiers.map(tier => (
                <option key={tier.value} value={tier.value}>{tier.label}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rewards Grid */}
      {filteredRewards.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
          <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {rewards.length === 0 ? 'No Rewards Created' : 'No Rewards Found'}
          </h3>
          <p className="text-gray-500 mb-6">
            {rewards.length === 0 
              ? 'Create your first reward to start engaging customers with your loyalty program.'
              : 'Try adjusting your search or filter criteria.'
            }
          </p>
          {rewards.length === 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200"
            >
              Create Your First Reward
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRewards.map((reward) => {
            const categoryInfo = getCategoryInfo(reward.category);
            const tierInfo = getTierInfo(reward.min_tier);
            const CategoryIcon = categoryInfo.icon;
            const TierIcon = tierInfo.icon;

            return (
              <div
                key={reward.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${categoryInfo.color}`}>
                        <CategoryIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-[#E6A85C] transition-colors">
                          {reward.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${tierInfo.color}`}>
                            {tierInfo.label}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            reward.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {reward.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {reward.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {reward.description}
                    </p>
                  )}

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Points Required</span>
                      <span className="font-semibold text-gray-900">{reward.points_required}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Times Redeemed</span>
                      <span className="font-semibold text-gray-900">{reward.total_redeemed}</span>
                    </div>

                    {reward.total_available && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Available</span>
                        <span className="font-semibold text-gray-900">
                          {reward.total_available - reward.total_redeemed}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(reward)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleToggleActive(reward)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                        reward.is_active
                          ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                          : 'text-green-700 bg-green-100 hover:bg-green-200'
                      }`}
                    >
                      {reward.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {reward.is_active ? 'Disable' : 'Enable'}
                    </button>
                    
                    <button
                      onClick={() => handleDeleteReward(reward.id)}
                      className="flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingReward) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                {editingReward ? 'Edit Reward' : 'Create New Reward'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingReward(null);
                  resetForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  placeholder="e.g., Free Appetizer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  placeholder="Describe what customers get with this reward"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Points Required *
                  </label>
                  <input
                    type="number"
                    value={formData.points_required}
                    onChange={(e) => setFormData({ ...formData, points_required: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Available
                  </label>
                  <input
                    type="number"
                    value={formData.total_available || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      total_available: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                    placeholder="Unlimited"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Tier
                  </label>
                  <select
                    value={formData.min_tier}
                    onChange={(e) => setFormData({ ...formData, min_tier: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  >
                    {tiers.map(tier => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#E6A85C] border-gray-300 rounded focus:ring-[#E6A85C]"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active (customers can redeem this reward)
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingReward(null);
                  resetForm();
                }}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingReward ? handleUpdateReward : handleCreateReward}
                disabled={formLoading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingReward ? 'Update Reward' : 'Create Reward'}
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

export default RewardsPage;