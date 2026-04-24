import { supabase } from '@/lib/supabase';

export interface DBNotification {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(): Promise<DBNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return data ?? [];
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await (supabase as any)
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
}

// Map a DB notification type + payload to display-ready content
export function formatNotification(n: DBNotification): {
  title: string;
  desc: string;
  icon: string;
  color: string;
} {
  const p = n.payload ?? {};
  switch (n.type) {
    case 'money_added':
      return {
        title: 'Money Added 💰',
        desc: `$${Number(p.amount ?? 0).toFixed(2)} was added to your wallet.`,
        icon: '💰', color: '#16a34a',
      };
    case 'job_claimed':
      return {
        title: 'Cleaner Applied 🏃',
        desc: 'A cleaner applied to your job. Review and approve them.',
        icon: '🏃', color: '#0284c7',
      };
    case 'cleaner_approved':
      return {
        title: 'Cleaner Hired ✅',
        desc: `${p.employee_name || 'Your cleaner'} is now on the way!`,
        icon: '✅', color: '#0284c7',
      };
    case 'payout_sent':
      return {
        title: 'Payment Released 💸',
        desc: `$${Number(p.amount ?? 0).toFixed(2)} released. Job completed!`,
        icon: '✨', color: '#314158',
      };
    case 'application_approved':
      return {
        title: 'Application Approved! 🎉',
        desc: p.message || 'Your application was approved. The job is now In Progress.',
        icon: '🎉', color: '#16a34a',
      };
    case 'payout_received':
      return {
        title: 'Payment Received 💰',
        desc: `$${Number(p.amount ?? 0).toFixed(2)} deposited to your wallet.`,
        icon: '💰', color: '#16a34a',
      };
    default:
      return {
        title: 'Notification',
        desc: JSON.stringify(p),
        icon: '🔔', color: '#64748b',
      };
  }
}
