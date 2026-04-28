import { supabase } from '@/lib/supabase';
import type { Dispute } from '@/types';

export async function submitDispute(
  jobId: string,
  reportedId: string,
  reason: string,
  description: string,
  evidenceUrls?: string[]
): Promise<Dispute> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await (supabase as any)
    .from('disputes')
    .insert([{
      job_id: jobId,
      reporter_id: user.id,
      reported_id: reportedId,
      reason,
      description: description.trim(),
      status: 'OPEN',
      evidence_urls: evidenceUrls || [],
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getJobDispute(jobId: string): Promise<Dispute | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase as any)
    .from('disputes')
    .select('*')
    .eq('job_id', jobId)
    .eq('reporter_id', user.id)
    .maybeSingle();

  if (error) return null;
  return data;
}
