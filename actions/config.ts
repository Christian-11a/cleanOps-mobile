import { supabase } from '@/lib/supabase';

export interface PlatformConfig {
  platform_fee_pct: number;
  max_active_jobs: number;
  maintenance_mode: boolean;
}

let cachedConfig: PlatformConfig | null = null;

/**
 * Fetches the platform configuration from the database.
 * Falls back to defaults if the database record is missing or fetch fails.
 * Includes a simple in-memory cache to avoid repeated DB calls in a single session.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig !== null) return cachedConfig;

  try {
    const { data, error } = await (supabase as any)
      .from('platform_config')
      .select('platform_fee_pct, max_active_jobs, maintenance_mode')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.warn('Failed to fetch platform config, falling back to defaults:', error);
      return {
        platform_fee_pct: 15,
        max_active_jobs: 4,
        maintenance_mode: false,
      };
    }

    cachedConfig = {
      platform_fee_pct: parseFloat(data.platform_fee_pct) || 15,
      max_active_jobs: parseInt(data.max_active_jobs) || 4,
      maintenance_mode: !!data.maintenance_mode,
    };
    return cachedConfig;
  } catch (err) {
    console.error('Error in getPlatformConfig:', err);
    return {
      platform_fee_pct: 15,
      max_active_jobs: 4,
      maintenance_mode: false,
    };
  }
}

/**
 * Backward compatibility: Fetches only the platform fee percentage.
 */
export async function getPlatformFee(): Promise<number> {
  const config = await getPlatformConfig();
  return config.platform_fee_pct;
}
