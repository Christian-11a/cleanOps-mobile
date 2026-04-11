// Mobile equivalent of the web's app/actions/payments.ts
import { supabase } from '@/lib/supabase';

export async function addMoney(amount: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any).rpc('add_money', {
    user_id: user.id,
    amount,
  });
  if (error) throw error;
}

export async function withdraw(amount: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const balance = await getBalance();
  if (balance < amount) throw new Error('Insufficient balance');

  const { error } = await (supabase as any).rpc('add_money', {
    user_id: user.id,
    amount: -amount,
  });
  if (error) throw error;
}

export async function getBalance(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('money_balance')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return (data as any)?.money_balance ?? 0;
}
