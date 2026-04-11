import { supabase } from '@/lib/supabase';

export async function updateProfile(fullName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', user.id);

  if (error) throw error;
}
