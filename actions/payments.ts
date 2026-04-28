// Mobile equivalent of the web's actions/payments.ts
import { supabase } from '@/lib/supabase';

async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Unauthorized');
  return session.user.id;
}

export async function addMoney(amount: number): Promise<void> {
  const userId = await getUserId();
  const { error } = await (supabase as any).rpc('add_money', {
    user_id: userId,
    amount,
  });
  if (error) throw error;
}

export async function withdraw(amount: number): Promise<void> {
  const userId = await getUserId();
  const balance = await getBalance();
  if (balance < amount) throw new Error('Insufficient balance');

  const { error } = await (supabase as any).rpc('add_money', {
    user_id: userId,
    amount: -amount,
  });
  if (error) throw error;
}

export async function getBalance(): Promise<number> {
  const userId = await getUserId();
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('money_balance')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return (data as any)?.money_balance ?? 0;
}

export async function getTransactions(): Promise<any[]> {
  const userId = await getUserId();
  const { data, error } = await (supabase as any)
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((tx: any) => {
    let description = tx.payload?.description;
    
    // Clean up hardcoded caps from older migrations or system types
    if (!description || tx.type === 'PAYOUT' || tx.type === 'PAYMENT' || tx.type === 'TOP_UP' || tx.type === 'WITHDRAWAL') {
      if (tx.type === 'PAYOUT') description = 'Job Earnings';
      else if (tx.type === 'PAYMENT') description = 'Job Payment';
      else if (tx.type === 'TOP_UP') description = 'Funds Deposited';
      else if (tx.type === 'WITHDRAWAL') description = 'Funds Withdrawn';
      else if (tx.type === 'REFUND') description = 'Refund Received';
    }

    return {
      ...tx,
      description: description || tx.type
    };
  });
}
