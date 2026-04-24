import { supabase } from '@/lib/supabase';
import type { Profile, EmployeeAvailability } from '@/types';

export async function updateProfile(fullName: string, phone?: string, address?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ 
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      location_address: address?.trim() || null
    })
    .eq('id', user.id);

  if (error) throw error;
}

export async function updateSettings(settings: Profile['settings']): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ settings })
    .eq('id', user.id);

  if (error) throw error;
}

export async function updateServiceRadius(radius: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ service_radius: radius })
    .eq('id', user.id);

  if (error) throw error;
}

export async function getAvailability(): Promise<EmployeeAvailability | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase as any)
    .from('employee_availability')
    .select('*')
    .eq('employee_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') return null; // PGRST116 is 'no rows returned'
  return data as EmployeeAvailability;
}

export async function updateAvailability(availability: Partial<EmployeeAvailability>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any)
    .from('employee_availability')
    .upsert({ 
      employee_id: user.id,
      ...availability,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}
