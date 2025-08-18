import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Reward = Database['public']['Tables']['rewards']['Row'];
type RewardInsert = Database['public']['Tables']['rewards']['Insert'];
type RewardUpdate = Database['public']['Tables']['rewards']['Update'];
type RewardRedemption = Database['public']['Tables']['reward_redemptions']['Row'];

export class RewardService {
  static async getRewards(restaurantId: string): Promise<Reward[]> {
    try {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('points_required', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error in getRewards:', error);
      return [];
    }
  }

  static async getAvailableRewards(restaurantId: string, customerId: string): Promise<Reward[]> {
    try {
      if (!restaurantId) return [];

      console.log('🔍 DEBUG: Fetching rewards for restaurant:', restaurantId, 'customer:', customerId);
      
      // Get customer tier to filter rewards appropriately
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('current_tier, total_points')
        .eq('id', customerId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (customerError) {
        console.error('❌ DEBUG: Could not fetch customer tier:', customerError);
        // Don't return early, continue with default tier
      }

      const customerTier = customer?.current_tier || 'bronze';
      console.log('👤 DEBUG: Customer tier:', customerTier, 'Customer points:', customer?.total_points);

      // Get all active rewards for the restaurant
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('points_required', { ascending: true });

      if (error) {
        console.error('❌ DEBUG: Error fetching rewards:', error);
        throw new Error(error.message);
      }

      console.log('🎁 DEBUG: Found total rewards:', data?.length || 0);
      console.log('🎁 DEBUG: Raw rewards data:', data);
      
      // Filter rewards based on customer tier
      const tierOrder = { bronze: 0, silver: 1, gold: 2 };
      const customerTierLevel = tierOrder[customerTier as keyof typeof tierOrder];
      
      const availableRewards = (data || []).filter(reward => {
        const rewardTierLevel = tierOrder[reward.min_tier as keyof typeof tierOrder];
        const tierAllowed = customerTierLevel >= rewardTierLevel;
        const isAvailable = !reward.total_available || reward.total_redeemed < reward.total_available;
        
        console.log(`🎯 DEBUG: Reward "${reward.name}": tier ${reward.min_tier} (${rewardTierLevel}) vs customer ${customerTier} (${customerTierLevel}) = ${tierAllowed}, available: ${isAvailable}, active: ${reward.is_active}`);
        
        return tierAllowed && isAvailable && reward.is_active;
      });

      console.log('✅ DEBUG: Available rewards after filtering:', availableRewards.length);
      console.log('✅ DEBUG: Final available rewards:', availableRewards.map(r => ({ name: r.name, tier: r.min_tier, points: r.points_required })));
      
      return availableRewards;
    } catch (error: any) {
      console.error('💥 DEBUG: Error in getAvailableRewards:', error);
      return [];
    }
  }

  static async getReward(restaurantId: string, rewardId: string): Promise<Reward | null> {
    try {
      if (!restaurantId) return null;

      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in getReward:', error);
      return null;
    }
  }

  static async createReward(restaurantId: string, rewardData: Omit<RewardInsert, 'restaurant_id'>): Promise<Reward> {
    if (!restaurantId) {
      throw new Error('Restaurant not found. Please create a restaurant first.');
    }

    const { data, error } = await supabase
      .from('rewards')
      .insert({
        ...rewardData,
        restaurant_id: restaurantId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  static async updateReward(restaurantId: string, rewardId: string, updates: RewardUpdate): Promise<Reward | null> {
    try {
      if (!restaurantId) return null;

      const { data, error } = await supabase
        .from('rewards')
        .update(updates)
        .eq('id', rewardId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in updateReward:', error);
      return null;
    }
  }

  static async deleteReward(restaurantId: string, rewardId: string): Promise<void> {
    if (!restaurantId) {
      throw new Error('Restaurant not found');
    }

    const { error } = await supabase
      .from('rewards')
      .delete()
      .eq('id', rewardId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(error.message);
    }
  }

  static async redeemReward(restaurantId: string, customerId: string, rewardId: string): Promise<RewardRedemption> {
  }
  static async redeemReward(restaurantId: string, customerId: string, rewardId: string, branchId?: string): Promise<RewardRedemption> {
    if (!restaurantId) {
      throw new Error('Restaurant not found');
    }

    // Get reward details
    const reward = await this.getReward(restaurantId, rewardId);
    if (!reward) {
      throw new Error('Reward not found');
    }
    
    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('total_points, current_tier')
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (customerError || !customer) {
      throw new Error('Customer not found');
    }

    // Check if customer has enough points
    if (customer.total_points < reward.points_required) {
      throw new Error('Insufficient points for this reward');
    }

    // Check tier requirement
    const tierOrder = { bronze: 0, silver: 1, gold: 2 };
    const customerTierLevel = tierOrder[customer.current_tier as keyof typeof tierOrder];
    const rewardTierLevel = tierOrder[reward.min_tier as keyof typeof tierOrder];
    
    if (customerTierLevel < rewardTierLevel) {
      throw new Error(`This reward requires ${reward.min_tier} tier or higher`);
    }

    // Check availability
    if (reward.total_available && reward.total_redeemed >= reward.total_available) {
      throw new Error('This reward is no longer available');
    }

    // Create redemption record
    const { data: redemption, error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        restaurant_id: restaurantId,
        customer_id: customerId,
        reward_id: rewardId,
        points_used: reward.points_required,
      })
      .select()
      .single();

    if (redemptionError) {
      throw new Error(redemptionError.message);
    }

    // Process point transaction (deduct points)
    const { error: transactionError } = await supabase.rpc('process_point_transaction', {
      p_restaurant_id: restaurantId,
      p_customer_id: customerId,
      p_type: 'redemption',
      p_points: -reward.points_required,
      p_description: `Redeemed: ${reward.name}`,
      p_amount_spent: 0,
      p_reward_id: rewardId,
      p_branch_id: branchId || null
    });

    if (transactionError) {
      throw new Error(transactionError.message);
    }

    // Update reward redemption count
    await supabase
      .from('rewards')
      .update({ total_redeemed: reward.total_redeemed + 1 })
      .eq('id', rewardId)
      .eq('restaurant_id', restaurantId);

    return redemption;
  }

  static async getRedemptions(restaurantId: string): Promise<(RewardRedemption & { 
    customer: { first_name: string; last_name: string; email: string };
    reward: { name: string };
  })[]> {
    try {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('reward_redemptions')
        .select(`
          *,
          customer:customers(first_name, last_name, email),
          reward:rewards(name)
        `)
        .eq('restaurant_id', restaurantId)
        .order('redeemed_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error in getRedemptions:', error);
      return [];
    }
  }

  static async markRedemptionAsUsed(restaurantId: string, redemptionId: string): Promise<void> {
    if (!restaurantId) {
      throw new Error('Restaurant not found');
    }

    const { error } = await supabase
      .from('reward_redemptions')
      .update({ 
        status: 'used',
        used_at: new Date().toISOString()
      })
      .eq('id', redemptionId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(error.message);
    }
  }

  static async getRewardStats(restaurantId: string): Promise<{
    totalRewards: number;
    activeRewards: number;
    totalRedemptions: number;
    popularRewards: { name: string; redemptions: number }[];
  }> {
    try {
      if (!restaurantId) {
        return {
          totalRewards: 0,
          activeRewards: 0,
          totalRedemptions: 0,
          popularRewards: [],
        };
      }

      const { data: rewards, error: rewardsError } = await supabase
        .from('rewards')
        .select('name, total_redeemed, is_active')
        .eq('restaurant_id', restaurantId);

      if (rewardsError) {
        throw new Error(rewardsError.message);
      }

      const totalRewards = rewards.length;
      const activeRewards = rewards.filter(r => r.is_active).length;
      const totalRedemptions = rewards.reduce((sum, r) => sum + r.total_redeemed, 0);
      const popularRewards = rewards
        .sort((a, b) => b.total_redeemed - a.total_redeemed)
        .slice(0, 5)
        .map(r => ({ name: r.name, redemptions: r.total_redeemed }));

      return {
        totalRewards,
        activeRewards,
        totalRedemptions,
        popularRewards,
      };
    } catch (error: any) {
      console.error('Error in getRewardStats:', error);
      return {
        totalRewards: 0,
        activeRewards: 0,
        totalRedemptions: 0,
        popularRewards: [],
      };
    }
  }
}