import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, RefreshCw, AlertCircle, CheckCircle, 
  DollarSign, Zap, Calculator, TrendingUp, Users, Crown,
  Award, ChefHat, Sparkles, BarChart3, Target, Info,
  Globe, Menu as MenuIcon, Percent
} from 'lucide-react';
import { LoyaltyConfigService, LoyaltyConfig } from '../services/loyaltyConfigService';
import { useAuth } from '../contexts/AuthContext';

const LoyaltyConfigPage: React.FC = () => {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewTier, setPreviewTier] = useState('bronze');
  const [previewAmount, setPreviewAmount] = useState(100);

  const { restaurant } = useAuth();

  useEffect(() => {
    if (restaurant) {
      fetchConfig();
    }
  }, [restaurant]);

  const fetchConfig = async () => {
    if (!restaurant) return;
    
    try {
      setLoading(true);
      setError(null);
      const loyaltyConfig = await LoyaltyConfigService.getLoyaltyConfig(restaurant.id);
      setConfig(loyaltyConfig);
    } catch (err: any) {
      console.error('Error fetching loyalty config:', err);
      setError(err.message || 'Failed to load loyalty configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurant || !config) return;

    try {
      setSaving(true);
      setError(null);
      await LoyaltyConfigService.updateLoyaltyConfig(restaurant.id, config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving loyalty config:', err);
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getPreviewCalculation = () => {
    if (!config) return { points: 0, valueAED: 0, breakdown: {} };
    
    return LoyaltyConfigService.calculatePointsPreview(
      config,
      undefined, // No specific menu item for blanket preview
      previewAmount,
      previewTier,
      1
    );
  };

  const tiers = [
    { value: 'bronze', label: 'Bronze', icon: ChefHat, color: 'text-orange-600' },
    { value: 'silver', label: 'Silver', icon: Award, color: 'text-gray-600' },
    { value: 'gold', label: 'Gold', icon: Crown, color: 'text-yellow-600' },
    { value: 'platinum', label: 'Platinum', icon: Sparkles, color: 'text-purple-600' }
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-gray-200 rounded-2xl"></div>
          <div className="h-96 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Configuration</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchConfig}
            className="px-6 py-3 bg-[#1E2A78] text-white rounded-lg hover:bg-[#3B4B9A] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!config) return null;

  const preview = getPreviewCalculation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Program Configuration</h1>
          <p className="text-gray-600 mt-1">Configure point values, blanket modes, and tier multipliers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5" />
          <span>Configuration saved successfully!</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="xl:col-span-2 space-y-6">
          {/* Point Value Configuration */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Point Value</h3>
                <p className="text-sm text-gray-600">Set the AED value of each loyalty point</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-blue-900">1 Point Equals</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.pointValueAED}
                    onChange={(e) => setConfig({
                      ...config,
                      pointValueAED: parseFloat(e.target.value) || 0.05
                    })}
                    className="w-20 px-3 py-2 border border-blue-200 rounded-lg text-center font-mono"
                    step="0.01"
                    min="0.01"
                    max="1.00"
                  />
                  <span className="font-medium text-blue-900">AED</span>
                </div>
              </div>
              <p className="text-sm text-blue-700">
                This rate applies to all point calculations across smart auto, manual, and spend-based modes.
              </p>
            </div>
          </div>

          {/* Blanket Mode Configuration */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Globe className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Blanket Mode</h3>
                <p className="text-sm text-gray-600">Apply loyalty rules globally across all menu items</p>
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
              <div>
                <p className="font-medium text-gray-900">Enable Blanket Mode</p>
                <p className="text-sm text-gray-600">Override individual menu item settings</p>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  blanketMode: { ...config.blanketMode, enabled: !config.blanketMode.enabled }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.blanketMode.enabled ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.blanketMode.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {config.blanketMode.enabled && (
              <div className="space-y-4">
                {/* Mode Selection */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setConfig({
                      ...config,
                      blanketMode: { ...config.blanketMode, type: 'smart' }
                    })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      config.blanketMode.type === 'smart'
                        ? 'border-[#E6A85C] bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <BarChart3 className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <p className="font-medium text-sm">Smart Auto</p>
                    <p className="text-xs text-gray-600">Profit-based</p>
                  </button>

                  <button
                    onClick={() => setConfig({
                      ...config,
                      blanketMode: { ...config.blanketMode, type: 'manual' }
                    })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      config.blanketMode.type === 'manual'
                        ? 'border-[#E6A85C] bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Calculator className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <p className="font-medium text-sm">Manual</p>
                    <p className="text-xs text-gray-600">Points per AED</p>
                  </button>

                  <button
                    onClick={() => setConfig({
                      ...config,
                      blanketMode: { ...config.blanketMode, type: 'spend' }
                    })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      config.blanketMode.type === 'spend'
                        ? 'border-[#E6A85C] bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Target className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                    <p className="font-medium text-sm">Spend-Based</p>
                    <p className="text-xs text-gray-600">Direct ratio</p>
                  </button>
                </div>

                {/* Mode-specific Settings */}
                {config.blanketMode.type === 'smart' && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                    <h5 className="font-medium text-blue-900 mb-3">Smart Auto Settings</h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profit Allocation Percentage
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={config.blanketMode.smartSettings.profitAllocationPercent}
                          onChange={(e) => setConfig({
                            ...config,
                            blanketMode: {
                              ...config.blanketMode,
                              smartSettings: {
                                profitAllocationPercent: parseInt(e.target.value)
                              }
                            }
                          })}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={config.blanketMode.smartSettings.profitAllocationPercent}
                            onChange={(e) => setConfig({
                              ...config,
                              blanketMode: {
                                ...config.blanketMode,
                                smartSettings: {
                                  profitAllocationPercent: parseInt(e.target.value) || 20
                                }
                              }
                            })}
                            className="w-16 px-2 py-1 border border-blue-200 rounded text-center"
                            min="1"
                            max="50"
                          />
                          <Percent className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">
                        Percentage of estimated profit (30% margin) to allocate as points
                      </p>
                    </div>
                  </div>
                )}

                {config.blanketMode.type === 'manual' && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <h5 className="font-medium text-green-900 mb-3">Manual Settings</h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Points per AED Spent
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={config.blanketMode.manualSettings.pointsPerAED}
                          onChange={(e) => setConfig({
                            ...config,
                            blanketMode: {
                              ...config.blanketMode,
                              manualSettings: {
                                pointsPerAED: parseFloat(e.target.value) || 0.1
                              }
                            }
                          })}
                          className="w-24 px-3 py-2 border border-green-200 rounded-lg text-center"
                          step="0.1"
                          min="0.1"
                          max="5.0"
                        />
                        <span className="text-green-700">points per 1 AED</span>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        Example: 0.1 = 1 point per 10 AED spent
                      </p>
                    </div>
                  </div>
                )}

                {config.blanketMode.type === 'spend' && (
                  <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-200">
                    <h5 className="font-medium text-purple-900 mb-3">Spend-Based Settings</h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Points per AED
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={config.blanketMode.spendSettings.pointsPerAED}
                          onChange={(e) => setConfig({
                            ...config,
                            blanketMode: {
                              ...config.blanketMode,
                              spendSettings: {
                                pointsPerAED: parseFloat(e.target.value) || 0.2
                              }
                            }
                          })}
                          className="w-24 px-3 py-2 border border-purple-200 rounded-lg text-center"
                          step="0.1"
                          min="0.1"
                          max="2.0"
                        />
                        <span className="text-purple-700">points per 1 AED</span>
                      </div>
                      <p className="text-xs text-purple-700 mt-1">
                        Example: 0.2 = 1 point per 5 AED spent
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tier Multipliers */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Tier Multipliers</h3>
                <p className="text-sm text-gray-600">Bonus multipliers for different customer tiers</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {tiers.map((tier) => {
                const TierIcon = tier.icon;
                return (
                  <div key={tier.value} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <TierIcon className={`h-5 w-5 ${tier.color}`} />
                      <span className="font-medium text-gray-900">{tier.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={config.tierMultipliers[tier.value as keyof typeof config.tierMultipliers]}
                        onChange={(e) => setConfig({
                          ...config,
                          tierMultipliers: {
                            ...config.tierMultipliers,
                            [tier.value]: parseFloat(e.target.value) || 1.0
                          }
                        })}
                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center"
                        step="0.25"
                        min="1.0"
                        max="5.0"
                      />
                      <span className="text-gray-600">×</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Zap className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Live Preview</h3>
              <p className="text-sm text-gray-600">Test your configuration</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Preview Controls */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Amount (AED)
              </label>
              <input
                type="number"
                value={previewAmount}
                onChange={(e) => setPreviewAmount(parseInt(e.target.value) || 100)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                min="1"
                max="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Tier
              </label>
              <select
                value={previewTier}
                onChange={(e) => setPreviewTier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                {tiers.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label} ({config.tierMultipliers[tier.value as keyof typeof config.tierMultipliers]}×)
                  </option>
                ))}
              </select>
            </div>

            {/* Preview Results */}
            <div className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-xl p-4 text-white">
              <div className="text-center mb-4">
                <p className="text-3xl font-bold">{preview.points}</p>
                <p className="text-sm opacity-90">points earned</p>
                <p className="text-xs opacity-75 mt-1">
                  ≈ {preview.valueAED.toFixed(3)} AED value
                </p>
              </div>
              
              {preview.breakdown.mode && (
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-xs font-medium mb-2">{preview.breakdown.mode}</p>
                  <div className="text-xs space-y-1 opacity-90">
                    {preview.breakdown.mode.includes('Smart') && (
                      <>
                        <p>Estimated Profit: {preview.breakdown.estimatedProfit?.toFixed(2)} AED</p>
                        <p>Allocation: {preview.breakdown.allocationPercent}%</p>
                        <p>Reward Value: {preview.breakdown.rewardValueAED?.toFixed(3)} AED</p>
                      </>
                    )}
                    {preview.breakdown.mode.includes('Manual') && (
                      <p>Rate: {preview.breakdown.pointsPerAED} points per AED</p>
                    )}
                    {preview.breakdown.mode.includes('Spend') && (
                      <p>Rate: {preview.breakdown.pointsPerAED} points per AED</p>
                    )}
                    <p>Tier Multiplier: {preview.breakdown.tierMultiplier}×</p>
                    <p>Point Value: {preview.breakdown.pointValueAED} AED each</p>
                  </div>
                </div>
              )}
            </div>

            {/* Configuration Status */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h5 className="font-medium text-gray-900 mb-2">Current Configuration</h5>
              <div className="text-sm space-y-1 text-gray-600">
                <p>Point Value: {config.pointValueAED} AED</p>
                <p>Blanket Mode: {config.blanketMode.enabled ? 'Enabled' : 'Disabled'}</p>
                {config.blanketMode.enabled && (
                  <p>Mode: {config.blanketMode.type.charAt(0).toUpperCase() + config.blanketMode.type.slice(1)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyConfigPage;