import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, Eye, EyeOff, Search, MapPin,
  Building, Users, TrendingUp, Gift, DollarSign,
  X, Save, AlertCircle, CheckCircle, Key, Lock,
  MoreVertical, Settings, Target, BarChart3
} from 'lucide-react';
import { BranchService, Branch, BranchStats } from '../services/branchService';
import { useAuth } from '../contexts/AuthContext';

const BranchManagement: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allTimeStats, setAllTimeStats] = useState<Record<string, BranchStats>>({});
  const [branchStats, setBranchStats] = useState<Record<string, BranchStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    staff_password: '',
    is_active: true
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { restaurant } = useAuth();

  useEffect(() => {
    if (restaurant) {
      fetchBranches();
    }
  }, [restaurant]);

  const fetchBranches = async () => {
    if (!restaurant) return;
    
    try {
      setLoading(true);
      setError(null);
      const branchesData = await BranchService.getBranches(restaurant.id);
      setBranches(branchesData);
      
      // Fetch stats for each branch
      const statsPromises = branchesData.map(async (branch) => {
        const [dailyStats, allTimeStatsData] = await Promise.all([
          BranchService.getBranchStats(restaurant.id, branch.id),
          BranchService.getAllTimeBranchStats(restaurant.id, branch.id)
        ]);
        return { branchId: branch.id, dailyStats, allTimeStats: allTimeStatsData };
      });
      
      const statsResults = await Promise.all(statsPromises);
      const dailyStatsMap: Record<string, BranchStats> = {};
      const allTimeStatsMap: Record<string, BranchStats> = {};
      statsResults.forEach(({ branchId, dailyStats, allTimeStats }) => {
        dailyStatsMap[branchId] = dailyStats;
        allTimeStatsMap[branchId] = allTimeStats;
      });
      setBranchStats(dailyStatsMap);
      setAllTimeStats(allTimeStatsMap);
      
    } catch (err: any) {
      console.error('Error fetching branches:', err);
      setError(err.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!restaurant) return;

    try {
      setFormLoading(true);
      setFormError('');

      if (!formData.name.trim()) {
        setFormError('Branch name is required');
        return;
      }

      if (!formData.location.trim()) {
        setFormError('Branch location is required');
        return;
      }

      if (!formData.staff_password.trim()) {
        setFormError('Staff password is required');
        return;
      }

      if (formData.staff_password.length < 4) {
        setFormError('Staff password must be at least 4 characters');
        return;
      }

      await BranchService.createBranch({
        restaurant_id: restaurant.id,
        name: formData.name,
        location: formData.location,
        staff_password: formData.staff_password,
        is_active: formData.is_active
      });

      await fetchBranches();
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      console.error('Error creating branch:', err);
      setFormError(err.message || 'Failed to create branch');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateBranch = async () => {
    if (!restaurant || !editingBranch) return;

    try {
      setFormLoading(true);
      setFormError('');

      if (!formData.name.trim()) {
        setFormError('Branch name is required');
        return;
      }

      await BranchService.updateBranch(restaurant.id, editingBranch.id, {
        name: formData.name,
        location: formData.location,
        staff_password: formData.staff_password,
        is_active: formData.is_active
      });

      await fetchBranches();
      setEditingBranch(null);
      resetForm();
    } catch (err: any) {
      console.error('Error updating branch:', err);
      setFormError(err.message || 'Failed to update branch');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!restaurant) return;

    if (!confirm('Are you sure you want to delete this branch? This action cannot be undone.')) {
      return;
    }

    try {
      await BranchService.deleteBranch(restaurant.id, branchId);
      await fetchBranches();
    } catch (err: any) {
      console.error('Error deleting branch:', err);
      alert(err.message || 'Failed to delete branch');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      staff_password: '',
      is_active: true
    });
    setFormError('');
    setShowPassword(false);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location,
      staff_password: branch.staff_password,
      is_active: branch.is_active
    });
    setFormError('');
  };

  const generatePassword = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, staff_password: result });
  };

  const filteredBranches = branches.filter(branch => 
    branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Branches</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchBranches}
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
          <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
          <p className="text-gray-600 mt-1">Manage restaurant branches and staff access</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Add Branch
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
          />
        </div>
      </div>

      {/* Branches Grid */}
      {filteredBranches.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
          <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {branches.length === 0 ? 'No Branches Created' : 'No Branches Found'}
          </h3>
          <p className="text-gray-500 mb-6">
            {branches.length === 0 
              ? 'Create your first branch to start managing staff access and branch-specific data.'
              : 'Try adjusting your search criteria.'
            }
          </p>
          {branches.length === 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200"
            >
              Create Your First Branch
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBranches.map((branch) => {
            const dailyStats = branchStats[branch.id] || {
              totalCustomers: 0,
              totalRedemptions: 0,
              totalPointsIssued: 0,
              totalRevenue: 0,
              recentTransactions: []
            };
            
            const allTimeStatsData = allTimeStats[branch.id] || {
              totalCustomers: 0,
              totalRedemptions: 0,
              totalPointsIssued: 0,
              totalRevenue: 0,
              recentTransactions: []
            };

            return (
              <div
                key={branch.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Building className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-[#E6A85C] transition-colors">
                          {branch.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-600">{branch.location}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Today's Stats */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Today's Performance</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Users className="h-3 w-3 text-blue-600" />
                          <span className="text-xs text-blue-600">Customers</span>
                        </div>
                        <p className="text-sm font-bold text-blue-900">{dailyStats.totalCustomers}</p>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingUp className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600">Points</span>
                        </div>
                        <p className="text-sm font-bold text-green-900">{dailyStats.totalPointsIssued}</p>
                      </div>
                      
                      <div className="bg-purple-50 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Gift className="h-3 w-3 text-purple-600" />
                          <span className="text-xs text-purple-600">Redemptions</span>
                        </div>
                        <p className="text-sm font-bold text-purple-900">{dailyStats.totalRedemptions}</p>
                      </div>
                      
                      <div className="bg-yellow-50 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <DollarSign className="h-3 w-3 text-yellow-600" />
                          <span className="text-xs text-yellow-600">Revenue</span>
                        </div>
                        <p className="text-sm font-bold text-yellow-900">{dailyStats.totalRevenue.toFixed(0)} AED</p>
                      </div>
                    </div>
                  </div>

                  {/* All-Time Stats */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">All-Time Performance</h4>
                    <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="text-xs text-gray-600">Customers</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{allTimeStatsData.totalCustomers}</p>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Gift className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-gray-600">Redemptions</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{allTimeStatsData.totalRedemptions}</p>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="text-xs text-gray-600">Points</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{allTimeStatsData.totalPointsIssued.toLocaleString()}</p>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-yellow-600" />
                        <span className="text-xs text-gray-600">Revenue</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{allTimeStatsData.totalRevenue.toFixed(0)} AED</p>
                    </div>
                  </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      branch.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Key className="h-3 w-3" />
                      <span>Password Protected</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(branch)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleDeleteBranch(branch.id)}
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
      {(showCreateModal || editingBranch) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingBranch(null);
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
                  Branch Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  placeholder="e.g., Sheikh Zayed Branch"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  placeholder="e.g., Sheikh Zayed Road, Dubai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff Password *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.staff_password}
                      onChange={(e) => setFormData({ ...formData, staff_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent pr-10"
                      placeholder="Enter staff password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Staff will use this password to access the branch system
                </p>
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
                  Active (staff can access this branch)
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingBranch(null);
                  resetForm();
                }}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingBranch ? handleUpdateBranch : handleCreateBranch}
                disabled={formLoading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingBranch ? 'Update Branch' : 'Create Branch'}
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

export default BranchManagement;