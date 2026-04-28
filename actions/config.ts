import { supabase } from '@/lib/supabase';

let cachedFee: number | null = null;

/**
 * Fetches the platform fee percentage from the database.
 * Falls back to 15 if the database record is missing or fetch fails.
 * Includes a simple in-memory cache to avoid repeated DB calls in a single session.
 */
export async function getPlatformFee(): Promise<number> {
  if (cachedFee !== null) return cachedFee;

  try {
    const { data, error } = await (supabase as any)
      .from('platform_config')
      .select('value')
      .eq('key', 'platform_fee_pct')
      .single();

    if (error || !data) {
      console.warn('Failed to fetch platform fee, falling back to 15%:', error);
      return 15;
    }

    const fee = parseFloat(data.value);
    cachedFee = isNaN(fee) ? 15 : fee;
    return cachedFee;
  } catch (err) {
    console.error('Error in getPlatformFee:', err);
    return 15;
  }
}
