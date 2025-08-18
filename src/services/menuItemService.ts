import { supabase } from '../lib/supabase';

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  category: string;
  cost_price: number;
  selling_price: number;
  loyalty_mode: 'smart' | 'manual' | 'none';
  loyalty_settings: {
    profit_allocation_percent?: number;
    fixed_points?: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItemInsert {
  restaurant_id: string;
  name: string;
  description?: string;
  category: string;
  cost_price: number;
  selling_price: number;
  loyalty_mode: 'smart' | 'manual' | 'none';
  loyalty_settings: {
    profit_allocation_percent?: number;
    fixed_points?: number;
  };
  is_active?: boolean;
}

export interface MenuItemUpdate {
  name?: string;
  description?: string;
  category?: string;
  cost_price?: number;
  selling_price?: number;
  loyalty_mode?: 'smart' | 'manual' | 'none';
  loyalty_settings?: {
    profit_allocation_percent?: number;
    fixed_points?: number;
  };
  is_active?: boolean;
}

export class MenuItemService {
  static async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    try {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error in getMenuItems:', error);
      return [];
    }
  }

  static async getMenuItem(restaurantId: string, itemId: string): Promise<MenuItem | null> {
    try {
      if (!restaurantId) return null;

      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in getMenuItem:', error);
      return null;
    }
  }

  static async createMenuItem(itemData: MenuItemInsert): Promise<MenuItem> {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(itemData)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  static async updateMenuItem(
    restaurantId: string, 
    itemId: string, 
    updates: MenuItemUpdate
  ): Promise<MenuItem | null> {
    try {
      if (!restaurantId) return null;

      const { data, error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in updateMenuItem:', error);
      return null;
    }
  }

  static async deleteMenuItem(restaurantId: string, itemId: string): Promise<void> {
    if (!restaurantId) {
      throw new Error('Restaurant not found');
    }

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(error.message);
    }
  }

  static async calculatePointsForMenuItem(
    menuItemId: string,
    quantity: number = 1,
    customerTier: string = 'bronze'
  ): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('calculate_points_for_menu_item', {
        p_menu_item_id: menuItemId,
        p_quantity: quantity,
        p_customer_tier: customerTier
      });

      if (error) throw error;

      return data || 0;
    } catch (error) {
      console.error('Error calculating points for menu item:', error);
      return 0;
    }
  }

  static calculatePointsPreview(
    menuItem: MenuItem,
    quantity: number = 1,
    customerTier: string = 'bronze'
  ): number {
    // This is now handled by the unified loyalty system
    // Return 0 for preview - actual calculation happens in LoyaltyConfigService
    return 0;
  }

  static async getMenuItemsByCategory(restaurantId: string): Promise<Record<string, MenuItem[]>> {
    try {
      const items = await this.getMenuItems(restaurantId);
      const categorized: Record<string, MenuItem[]> = {};

      items.forEach(item => {
        if (!categorized[item.category]) {
          categorized[item.category] = [];
        }
        categorized[item.category].push(item);
      });

      return categorized;
    } catch (error) {
      console.error('Error getting menu items by category:', error);
      return {};
    }
  }

  static async createSampleMenuItems(restaurantId: string): Promise<void> {
    try {
      const sampleItems: MenuItemInsert[] = [
        {
          restaurant_id: restaurantId,
          name: 'Chicken Shawarma',
          description: 'Tender chicken with garlic sauce and vegetables',
          category: 'main',
          cost_price: 8.00,
          selling_price: 15.00,
          loyalty_mode: 'smart',
          loyalty_settings: { profit_allocation_percent: 20 }
        },
        {
          restaurant_id: restaurantId,
          name: 'Beef Burger',
          description: 'Juicy beef patty with cheese and fries',
          category: 'main',
          cost_price: 12.00,
          selling_price: 25.00,
          loyalty_mode: 'smart',
          loyalty_settings: { profit_allocation_percent: 15 }
        },
        {
          restaurant_id: restaurantId,
          name: 'Fresh Orange Juice',
          description: 'Freshly squeezed orange juice',
          category: 'beverage',
          cost_price: 2.00,
          selling_price: 8.00,
          loyalty_mode: 'manual',
          loyalty_settings: { fixed_points: 2 }
        },
        {
          restaurant_id: restaurantId,
          name: 'Caesar Salad',
          description: 'Fresh romaine lettuce with caesar dressing',
          category: 'salad',
          cost_price: 6.00,
          selling_price: 18.00,
          loyalty_mode: 'smart',
          loyalty_settings: { profit_allocation_percent: 25 }
        },
        {
          restaurant_id: restaurantId,
          name: 'Chocolate Cake',
          description: 'Rich chocolate cake with cream',
          category: 'dessert',
          cost_price: 4.00,
          selling_price: 12.00,
          loyalty_mode: 'manual',
          loyalty_settings: { fixed_points: 5 }
        }
      ];

      for (const item of sampleItems) {
        await this.createMenuItem(item);
      }

      console.log('✅ Sample menu items created');
    } catch (error) {
      console.warn('⚠️ Failed to create sample menu items:', error);
    }
  }
}