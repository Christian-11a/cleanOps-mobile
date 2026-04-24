import { supabase } from '@/lib/supabase';
import type { PaymentMethod, WithdrawalTransaction } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_TX = 'cleanops_employee_withdrawals';

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('payment_methods')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching employee payment methods:', error);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    type: m.type,
    brand: m.brand,
    last4: m.last4,
    expiry: m.expiry,
    cardholderName: m.cardholder_name,
    phoneNumber: m.phone_number,
    isDefault: m.is_default,
    created_at: m.created_at,
  }));
}

export async function addPaymentMethod(method: Omit<PaymentMethod, 'id' | 'user_id' | 'isDefault' | 'created_at'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const existing = await getPaymentMethods();
  const isDefault = existing.length === 0;

  const { error } = await (supabase as any)
    .from('payment_methods')
    .insert([{
      user_id: user.id,
      type: method.type,
      brand: method.brand,
      last4: method.last4,
      expiry: method.expiry,
      cardholder_name: method.cardholderName,
      phone_number: method.phoneNumber,
      is_default: isDefault,
    }]);

  if (error) throw error;
}

export async function removePaymentMethod(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('payment_methods')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function setDefaultPaymentMethod(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await (supabase as any)
    .from('payment_methods')
    .update({ is_default: false })
    .eq('user_id', user.id);

  const { error } = await (supabase as any)
    .from('payment_methods')
    .update({ is_default: true })
    .eq('id', id);

  if (error) throw error;
}

export async function getWithdrawals(): Promise<WithdrawalTransaction[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const key = `${STORAGE_KEY_TX}_${user.id}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function addWithdrawal(amount: number, method: PaymentMethod): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const key = `${STORAGE_KEY_TX}_${user.id}`;
  const history = await getWithdrawals();
  const newTx: WithdrawalTransaction = {
    id: Math.random().toString(36).substring(7),
    amount,
    method_brand: method.brand,
    method_last4: method.last4 || '',
    method_name: method.cardholderName,
    created_at: new Date().toISOString(),
  };

  const updated = [newTx, ...history];
  await AsyncStorage.setItem(key, JSON.stringify(updated));
}
