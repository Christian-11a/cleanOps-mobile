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

export async function markNotificationRead(id: string): Promise<void> {
  await (supabase as any)
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('notifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function clearAllNotifications(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await (supabase as any)
    .from('notifications')
    .delete()
    .eq('user_id', user.id);
  if (error) throw error;
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
    case 'job_posted':
      return {
        title: 'Job Posted! 🚀',
        desc: `"${p.title || 'Your job'}" is now live. $${Number(p.amount ?? 0).toFixed(2)} is held in escrow.`,
        icon: '🚀', color: '#0ea5e9',
      };
    case 'money_added':
      return {
        title: 'Money Added 💰',
        desc: `$${Number(p.amount ?? 0).toFixed(2)} was added to your wallet.`,
        icon: '💰', color: '#16a34a',
      };
    case 'refund':
      return {
        title: 'Money Refunded 🔄',
        desc: p.description || `A refund of $${Number(p.amount ?? 0).toFixed(2)} was credited to your wallet.`,
        icon: '🔄', color: '#16a34a',
      };
    case 'job_claimed':
      return {
        title: 'Cleaner Interested 🤝',
        desc: `${p.applicant_name || 'A cleaner'} has applied to your job.`,
        icon: '🤝', color: '#0ea5e9',
      };
    case 'proof_submitted':
      return {
        title: 'Job Done! ✨',
        desc: `${p.worker_name || 'Your cleaner'} has finished and sent photos.`,
        icon: '✨', color: '#16a34a',
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
    case 'withdrawal':
    case 'money_withdrawn':
      return {
        title: 'Withdrawal Processed 🏦',
        desc: `$${Number(p.amount ?? 0).toFixed(2)} was removed from your wallet.`,
        icon: '🏦', color: '#f59e0b',
      };
    case 'new_review':
      const stars = p.rating ? '⭐'.repeat(p.rating) : '⭐';
      return {
        title: 'New Rating Received ⭐',
        desc: `${p.reviewer_name || 'A customer'} gave you ${stars}`,
        icon: '⭐', color: '#fbbf24',
      };
    default:
      return {
        title: 'Notification',
        desc: p.message || 'You have a new update.',
        icon: '🔔', color: '#64748b',
      };
  }
}
