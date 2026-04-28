import { supabase } from '@/lib/supabase';
import type { Review } from '@/types';

export async function submitReview(
  jobId: string,
  revieweeId: string,
  rating: number,
  comment?: string
): Promise<Review> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await (supabase as any)
    .from('reviews')
    .insert([{
      job_id: jobId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment: comment?.trim() || null,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getJobReview(jobId: string): Promise<Review | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase as any)
    .from('reviews')
    .select('*')
    .eq('job_id', jobId)
    .eq('reviewer_id', user.id)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function getProfileReviews(profileId: string): Promise<(Review & { reviewer?: { full_name: string } })[]> {
  const { data, error } = await (supabase as any)
    .from('reviews')
    .select(`
      *,
      reviewer:reviewer_id (
        full_name
      )
    `)
    .eq('reviewee_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    if (__DEV__) console.warn('Error fetching profile reviews:', error);
    return [];
  }
  return data ?? [];
}
