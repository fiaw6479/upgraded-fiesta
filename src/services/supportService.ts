import { supabase } from '../lib/supabase';

export interface SupportTicket {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_by_user_id: string;
  assigned_to_admin?: string;
  created_at: string;
  updated_at: string;
  restaurant?: {
    name: string;
    slug: string;
  };
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'restaurant_manager' | 'super_admin';
  sender_id: string;
  message: string;
  created_at: string;
}

export interface CreateTicketData {
  restaurant_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_by_user_id: string;
}

export interface CreateMessageData {
  ticket_id: string;
  sender_type: 'restaurant_manager' | 'super_admin';
  sender_id: string;
  message: string;
}

export class SupportService {
  // Get all tickets (for super admin)
  static async getAllTickets(): Promise<SupportTicket[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          restaurant:restaurants(name, slug)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching all tickets:', error);
      return [];
    }
  }

  // Get tickets for a specific restaurant
  static async getRestaurantTickets(restaurantId: string): Promise<SupportTicket[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching restaurant tickets:', error);
      return [];
    }
  }

  // Create a new ticket
  static async createTicket(ticketData: CreateTicketData): Promise<SupportTicket> {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update ticket status
  static async updateTicketStatus(
    ticketId: string, 
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
    assignedToAdmin?: string
  ): Promise<void> {
    const updates: any = { status };
    if (assignedToAdmin !== undefined) {
      updates.assigned_to_admin = assignedToAdmin;
    }

    const { error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) throw error;
  }

  // Get messages for a ticket
  static async getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching ticket messages:', error);
      return [];
    }
  }

  // Send a message
  static async sendMessage(messageData: CreateMessageData): Promise<SupportMessage> {
    // Validate sender_type
    if (!['restaurant_manager', 'super_admin'].includes(messageData.sender_type)) {
      throw new Error('Invalid sender type');
    }

    const { data, error } = await supabase
      .from('support_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get ticket statistics
  static async getTicketStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('status');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        open: data?.filter(t => t.status === 'open').length || 0,
        inProgress: data?.filter(t => t.status === 'in_progress').length || 0,
        resolved: data?.filter(t => t.status === 'resolved').length || 0,
        closed: data?.filter(t => t.status === 'closed').length || 0,
      };

      return stats;
    } catch (error: any) {
      console.error('Error fetching ticket stats:', error);
      return { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 };
    }
  }

  // Subscribe to real-time updates for tickets
  static subscribeToTickets(callback: (payload: any) => void) {
    return supabase
      .channel('support_tickets')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'support_tickets' }, 
        callback
      )
      .subscribe();
  }

  // Subscribe to real-time updates for messages
  static subscribeToMessages(ticketId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`support_messages_${ticketId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`
        }, 
        callback
      )
      .subscribe();
  }
}