// Mobile equivalent of app/actions/messages.ts
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';

export async function getMessages(jobId: string): Promise<Message[]> {
  const { data, error } = await (supabase as any)
    .from('messages')
    .select('*, profiles(full_name)')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(jobId: string, content: string): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await (supabase as any)
    .from('messages')
    .insert([{
      job_id: jobId,
      sender_id: user.id,
      content: content.trim(),
    }])
    .select('*, profiles(full_name)')
    .single();

  if (error) throw error;
  return data as Message;
}

export function subscribeToMessages(jobId: string, onMessage: (message: Message) => void) {
  const channel = supabase
    .channel(`messages:job:${jobId}`)
    .on(
      'postgres_changes' as any,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `job_id=eq.${jobId}`,
      },
      async (payload: any) => {
        // Fetch with profile join since realtime payload won't have it
        const { data } = await (supabase as any)
          .from('messages')
          .select('*, profiles(full_name)')
          .eq('id', payload.new.id)
          .single();
        if (data) onMessage(data as Message);
      },
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}