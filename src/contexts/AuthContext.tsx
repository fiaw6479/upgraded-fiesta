import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { SubscriptionService } from '../services/subscriptionService';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  settings: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  restaurant: Restaurant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata: {
    firstName: string;
    lastName: string;
    restaurantName: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        console.log('🔄 Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          return;
        }

        console.log('✅ Session retrieved:', session?.user?.id || 'No user');
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('👤 User found, fetching restaurant...');
          // Fetch restaurant without blocking - set loading to false immediately
          setLoading(false);
          fetchRestaurant(session.user.id);
        } else {
          console.log('👤 No user, setting loading to false');
          setLoading(false);
        }
      } catch (error) {
        console.error('💥 Error in getInitialSession:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.id || 'No user');
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Don't block UI for restaurant fetching
          fetchRestaurant(session.user.id);
          
          // Trigger subscription refresh for seamless updates
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('subscription-updated'));
          }, 500);
        } else {
          setRestaurant(null);
        }
        
        // Always set loading to false for auth state changes
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchRestaurant = async (userId: string) => {
    try {
      console.log('🏪 Fetching restaurant for user:', userId);
      
      // Simple query with shorter timeout
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, settings')
        .eq('owner_id', userId)
        .limit(1);

      if (error) {
        console.error('❌ Error fetching restaurant:', error);
        // Create restaurant in background if fetch fails
        createDefaultRestaurant(userId);
        return;
      }

      if (data && data.length > 0) {
        console.log('✅ Restaurant found:', data[0].name);
        setRestaurant(data[0]);
        return;
      }

      // If no restaurant exists, create one in background
      console.log('🏗️ No restaurant found, creating default restaurant...');
      createDefaultRestaurant(userId);
      
    } catch (error) {
      console.error('💥 Error in fetchRestaurant:', error);
      // Create restaurant in background if any error occurs
      createDefaultRestaurant(userId);
    }
  };

  const createDefaultRestaurant = async (userId: string) => {
    try {
      // First check if restaurant already exists
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', userId)
        .limit(1);

      if (existingRestaurant && existingRestaurant.length > 0) {
        console.log('🏪 Restaurant already exists, using existing...');
        setRestaurant(existingRestaurant[0]);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      
      const restaurantName = user?.user_metadata?.restaurant_name || 'My Restaurant';
      // Create a simple unique slug
      const baseSlug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const timestamp = Date.now();
      const slug = `${baseSlug}-${timestamp}`;

      console.log('🏗️ Creating restaurant:', restaurantName);

      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: restaurantName,
          owner_id: userId,
          slug: slug,
          settings: {
            points_per_dollar: 1,
            referral_bonus: 50,
            pointValueAED: 0.05,
            blanketMode: {
              enabled: true,
              type: 'manual',
              manualSettings: {
                pointsPerAED: 0.1
              }
            },
            tier_thresholds: {
              silver: 500,
              gold: 1000
            },
            loyalty_program: {
              name: 'Loyalty Program',
              description: 'Earn points with every purchase and redeem for rewards!'
            }
          }
        })
        .select()
        .single();

      if (restaurantError) {
        console.error('❌ Error creating restaurant:', restaurantError);
        // If it's a duplicate error, try to fetch existing
        if (restaurantError.code === '23505') {
          console.log('🔄 Duplicate detected, fetching existing restaurant...');
          const { data: existingRestaurant } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', userId)
            .limit(1);
          
          if (existingRestaurant && existingRestaurant.length > 0) {
            setRestaurant(existingRestaurant[0]);
            return;
          }
        }
        return;
      }

      console.log('✅ Restaurant created:', restaurant.name);
      setRestaurant(restaurant);
      
      // Create sample data in background without blocking
      setTimeout(() => {
        createSampleRewards(restaurant.id).catch(console.warn);
        createSampleMenuItems(restaurant.id).catch(console.warn);
      }, 100);
      
    } catch (error) {
      console.error('💥 Error creating default restaurant:', error);
    }
  };

  const createSampleRewards = async (restaurantId: string) => {
    try {
      const sampleRewards = [
        { name: 'Free Appetizer', description: 'Choose any appetizer from our menu', points_required: 100, category: 'food', min_tier: 'bronze' },
        { name: 'Free Dessert', description: 'Complimentary dessert of your choice', points_required: 150, category: 'food', min_tier: 'bronze' },
        { name: 'Free Drink', description: 'Any beverage from our drink menu', points_required: 75, category: 'beverage', min_tier: 'bronze' },
        { name: '10% Off Next Visit', description: 'Get 10% discount on your next meal', points_required: 200, category: 'discount', min_tier: 'bronze' }
      ];

      await supabase
        .from('rewards')
        .insert(
          sampleRewards.map(reward => ({
            ...reward,
            restaurant_id: restaurantId
          }))
        );
      
      console.log('✅ Sample rewards created');
    } catch (error) {
      console.warn('⚠️ Failed to create sample rewards:', error);
    }
  };
  
  const createSampleMenuItems = async (restaurantId: string) => {
    try {
      const { MenuItemService } = await import('../services/menuItemService');
      await MenuItemService.createSampleMenuItems(restaurantId);
      console.log('✅ Sample menu items created');
    } catch (error) {
      console.warn('⚠️ Failed to create sample menu items:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Provide user-friendly message for invalid credentials
        if (error.message === 'Invalid login credentials') {
          return { error: 'Incorrect email or password. Please try again.' };
        }
        return { error: error.message };
      }

      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    metadata: {
      firstName: string;
      lastName: string;
      restaurantName: string;
    }
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: metadata.firstName,
            last_name: metadata.lastName,
            restaurant_name: metadata.restaurantName,
          }
        }
      });

      if (error) {
        return { error: error.message };
      }

      // Create trial subscription for new users in background
      if (data.user) {
        setTimeout(() => {
          SubscriptionService.createSubscription(data.user.id, 'trial').catch(console.warn);
        }, 100);
      }

      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const signOut = async () => {
    try {
      console.log('🔄 Starting sign out process...');
      
      // Clear local state first
      setUser(null);
      setSession(null);
      setRestaurant(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Supabase sign out error:', error);
      } else {
        console.log('✅ Sign out successful');
      }
    } catch (error) {
      console.error('💥 Error during sign out:', error);
      // Clear state anyway to ensure user is logged out locally
      setUser(null);
      setSession(null);
      setRestaurant(null);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const value = {
    user,
    session,
    restaurant,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};