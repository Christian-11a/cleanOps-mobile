import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './authContext';
import { useToast } from './toastContext';
import { formatNotification, getNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification, clearAllNotifications } from '@/actions/notifications';

interface NotificationContextValue {
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  deleteNotif: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshNotifications: async () => {},
  markAllRead: async () => {},
  markAsRead: async () => {},
  deleteNotif: async () => {},
  clearAll: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count, error } = await (supabase as any)
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    if (!error) setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const formatted = formatNotification(payload.new);
          toast.show(formatted.title, 'info'); // Uses the professional title (e.g. Money Refunded)
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount, toast]);

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setUnreadCount(0);
  };

  const markAsRead = async (id: string) => {
    await markNotificationRead(id);
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const deleteNotif = async (id: string) => {
    await deleteNotification(id);
    await fetchUnreadCount();
  };

  const clearAll = async () => {
    await clearAllNotifications();
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshNotifications: fetchUnreadCount, markAllRead, markAsRead, deleteNotif, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
