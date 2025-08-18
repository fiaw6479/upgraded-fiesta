import { supabase } from '../lib/supabase';

export interface LoyaltyConfig {
  pointValueAED: number;
  blanketMode: {
    enabled: boolean;
    type: 'smart' | 'manual' | 'spend';
    smartSettings: {
      profitAllocationPercent: number;
    };
    manualSettings: {
      pointsPerAED: number;
    };
    spendSettings: {
      pointsPerAED: number;
    };
  };
  tierMultipliers: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
}

export class LoyaltyConfigService {
  static async getLoyaltyConfig(restaurantId: string): Promise<LoyaltyConfig> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .maybeSingle();

      if (error) throw error;

      const settings = data.settings || {};
      
      return {
        pointValueAED: settings.pointValueAED || 0.05,
        blanketMode: {
          enabled: settings.blanketMode?.enabled || false,
          type: settings.blanketMode?.type || 'smart',
          smartSettings: {
            profitAllocationPercent: settings.blanketMode?.smartSettings?.profitAllocationPercent || 20
          },
          manualSettings: {
            pointsPerAED: settings.blanketMode?.manualSettings?.pointsPerAED || 0.1
          },
          spendSettings: {
            pointsPerAED: settings.blanketMode?.spendSettings?.pointsPerAED || 0.2
          }
        },
        tierMultipliers: {
          bronze: settings.tierMultipliers?.bronze || 1.0,
          silver: settings.tierMultipliers?.silver || 1.25,
          gold: settings.tierMultipliers?.gold || 1.5,
          platinum: settings.tierMultipliers?.platinum || 2.0
        }
      };
    } catch (error) {
      console.error('Error fetching loyalty config:', error);
      return this.getDefaultConfig();
    }
  }

  static async updateLoyaltyConfig(restaurantId: string, config: Partial<LoyaltyConfig>): Promise<void> {
    try {
      const { data: currentData, error: fetchError } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .single();

      if (fetchError) throw fetchError;

      const currentSettings = currentData.settings || {};
      const updatedSettings = {
        ...currentSettings,
        ...config
      };

      const { error } = await supabase
        .from('restaurants')
        .update({ settings: updatedSettings })
        .eq('id', restaurantId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating loyalty config:', error);
      throw error;
    }
  }

  static async calculatePoints(
    restaurantId: string,
    menuItemId?: string,
    orderAmount: number = 0,
    customerTier: string = 'bronze',
    quantity: number = 1
  ): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('calculate_points_unified', {
        p_restaurant_id: restaurantId,
        p_menu_item_id: menuItemId || null,
        p_order_amount: orderAmount,
        p_customer_tier: customerTier,
        p_quantity: quantity
      });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error calculating points:', error);
      return 0;
    }
  }

  static calculatePointsPreview(
    config: LoyaltyConfig,
    menuItem?: {
      cost_price: number;
      selling_price: number;
      loyalty_mode: string;
      loyalty_settings: any;
    },
    orderAmount: number = 0,
    customerTier: string = 'bronze',
    quantity: number = 1
  ): { points: number; valueAED: number; breakdown: any } {
    let basePoints = 0;
    let breakdown: any = {};

    // Check blanket mode first
    if (config.blanketMode.enabled) {
      switch (config.blanketMode.type) {
        case 'smart':
          const estimatedProfit = orderAmount * 0.3; // 30% estimated profit margin
          const rewardValueAED = estimatedProfit * (config.blanketMode.smartSettings.profitAllocationPercent / 100);
          basePoints = Math.floor(rewardValueAED / config.pointValueAED);
          breakdown = {
            mode: 'Blanket Smart Auto',
            orderAmount,
            estimatedProfit,
            allocationPercent: config.blanketMode.smartSettings.profitAllocationPercent,
            rewardValueAED,
            basePoints
          };
          break;
          
        case 'manual':
          basePoints = Math.floor(orderAmount * config.blanketMode.manualSettings.pointsPerAED);
          breakdown = {
            mode: 'Blanket Manual',
            orderAmount,
            pointsPerAED: config.blanketMode.manualSettings.pointsPerAED,
            basePoints
          };
          break;
          
        case 'spend':
          basePoints = Math.floor(orderAmount * config.blanketMode.spendSettings.pointsPerAED);
          breakdown = {
            mode: 'Blanket Spend-Based',
            orderAmount,
            pointsPerAED: config.blanketMode.spendSettings.pointsPerAED,
            basePoints
          };
          break;
      }
    } else if (menuItem) {
      // Item-specific calculation
      if (menuItem.loyalty_mode === 'smart') {
        const profit = (menuItem.selling_price - menuItem.cost_price) * quantity;
        const allocationPercent = menuItem.loyalty_settings.profit_allocation_percent || 0;
        const rewardValueAED = profit * (allocationPercent / 100);
        basePoints = Math.floor(rewardValueAED / config.pointValueAED);
        breakdown = {
          mode: 'Item Smart Auto',
          costPrice: menuItem.cost_price,
          sellingPrice: menuItem.selling_price,
          profit,
          allocationPercent,
          rewardValueAED,
          basePoints
        };
      } else if (menuItem.loyalty_mode === 'manual') {
        basePoints = (menuItem.loyalty_settings.fixed_points || 0) * quantity;
        breakdown = {
          mode: 'Item Manual',
          fixedPoints: menuItem.loyalty_settings.fixed_points || 0,
          quantity,
          basePoints
        };
      }
    }

    // Apply tier multiplier
    const tierMultiplier = config.tierMultipliers[customerTier as keyof typeof config.tierMultipliers] || 1.0;
    const finalPoints = Math.floor(basePoints * tierMultiplier);
    const valueAED = finalPoints * config.pointValueAED;

    return {
      points: finalPoints,
      valueAED,
      breakdown: {
        ...breakdown,
        tierMultiplier,
        finalPoints,
        pointValueAED: config.pointValueAED
      }
    };
  }

  private static getDefaultConfig(): LoyaltyConfig {
    return {
      pointValueAED: 0.05,
      blanketMode: {
        enabled: false,
        type: 'smart',
        smartSettings: {
          profitAllocationPercent: 20
        },
        manualSettings: {
          pointsPerAED: 0.1
        },
        spendSettings: {
          pointsPerAED: 0.2
        }
      },
      tierMultipliers: {
        bronze: 1.0,
        silver: 1.25,
        gold: 1.5,
        platinum: 2.0
      }
    };
  }
}