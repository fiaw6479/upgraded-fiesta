import { supabase } from '../lib/supabase';

export interface Branch {
  id: string;
  restaurant_id: string;
  name: string;
  location: string;
  staff_password: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchInsert {
  restaurant_id: string;
  name: string;
  location: string;
  staff_password: string;
  is_active?: boolean;
}

export interface BranchUpdate {
  name?: string;
  location?: string;
  staff_password?: string;
  is_active?: boolean;
}

export interface BranchStats {
  totalCustomers: number;
  totalRedemptions: number;
  totalPointsIssued: number;
  totalRevenue: number;
  recentTransactions: any[];
}

export class BranchService {
  static async getBranches(restaurantId: string): Promise<Branch[]> {
    try {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error in getBranches:', error);
      return [];
    }
  }

  static async getBranch(restaurantId: string, branchId: string): Promise<Branch | null> {
    try {
      if (!restaurantId) return null;

      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in getBranch:', error);
      return null;
    }
  }

  static async createBranch(branchData: BranchInsert): Promise<Branch> {
    const { data, error } = await supabase
      .from('branches')
      .insert(branchData)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  static async updateBranch(
    restaurantId: string, 
    branchId: string, 
    updates: BranchUpdate
  ): Promise<Branch | null> {
    try {
      if (!restaurantId) return null;

      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', branchId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in updateBranch:', error);
      return null;
    }
  }

  static async deleteBranch(restaurantId: string, branchId: string): Promise<void> {
    if (!restaurantId) {
      throw new Error('Restaurant not found');
    }

    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', branchId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(error.message);
    }
  }

  static async getBranchStats(restaurantId: string, branchId: string): Promise<BranchStats> {
    try {
      if (!restaurantId || !branchId) {
        return {
          totalCustomers: 0,
          totalRedemptions: 0,
          totalPointsIssued: 0,
          totalRevenue: 0,
          recentTransactions: []
        };
      }

      // Get today's date for daily stats
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      // Get branch-specific transactions for today
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select(`
          *,
          customer:customers(first_name, last_name, email)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (transError) throw transError;

      // Get unique customers who had transactions today at this branch
      const uniqueCustomerIds = [...new Set(transactions?.map(t => t.customer_id) || [])];
      
      const totalCustomers = uniqueCustomerIds.length;
      const totalRedemptions = transactions?.filter(t => t.type === 'redemption').length || 0;
      const totalPointsIssued = transactions?.filter(t => t.points > 0).reduce((sum, t) => sum + t.points, 0) || 0;
      const totalRevenue = transactions?.reduce((sum, t) => sum + (t.amount_spent || 0), 0) || 0;
      const recentTransactions = transactions?.slice(0, 10) || [];

      return {
        totalCustomers,
        totalRedemptions,
        totalPointsIssued,
        totalRevenue,
        recentTransactions
      };
    } catch (error: any) {
      console.error('Error in getBranchStats:', error);
      return {
        totalCustomers: 0,
        totalRedemptions: 0,
        totalPointsIssued: 0,
        totalRevenue: 0,
        recentTransactions: []
      };
    }
  }

  static async getAllTimeBranchStats(restaurantId: string, branchId: string): Promise<BranchStats> {
    try {
      if (!restaurantId || !branchId) {
        return {
          totalCustomers: 0,
          totalRedemptions: 0,
          totalPointsIssued: 0,
          totalRevenue: 0,
          recentTransactions: []
        };
      }

      // Get all-time branch-specific transactions
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select(`
          *,
          customer:customers(first_name, last_name, email)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (transError) throw transError;

      // Get unique customers who have ever had transactions at this branch
      const uniqueCustomerIds = [...new Set(transactions?.map(t => t.customer_id) || [])];
      
      const totalCustomers = uniqueCustomerIds.length;
      const totalRedemptions = transactions?.filter(t => t.type === 'redemption').length || 0;
      const totalPointsIssued = transactions?.filter(t => t.points > 0).reduce((sum, t) => sum + t.points, 0) || 0;
      const totalRevenue = transactions?.reduce((sum, t) => sum + (t.amount_spent || 0), 0) || 0;
      const recentTransactions = transactions?.slice(0, 10) || [];

      return {
        totalCustomers,
        totalRedemptions,
        totalPointsIssued,
        totalRevenue,
        recentTransactions
      };
    } catch (error: any) {
      console.error('Error in getAllTimeBranchStats:', error);
      return {
        totalCustomers: 0,
        totalRedemptions: 0,
        totalPointsIssued: 0,
        totalRevenue: 0,
        recentTransactions: []
      };
    }
  }
  static async verifyBranchPassword(
    restaurantId: string, 
    branchId: string, 
    password: string
  ): Promise<boolean> {
    try {
      const branch = await this.getBranch(restaurantId, branchId);
      return branch?.staff_password === password;
    } catch (error) {
      console.error('Error verifying branch password:', error);
      return false;
    }
  }
}