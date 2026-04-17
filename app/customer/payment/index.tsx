import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/themeContext';
import { getBalance, addMoney, withdraw } from '@/app/actions/payments';
import { getCustomerJobs } from '@/app/actions/jobs';
import { useAuth } from '@/lib/authContext';
import type { Job } from '@/types';

type ModalMode = 'deposit' | 'withdraw' | null;

export default function CustomerPaymentScreen() {
  const router = useRouter();
  const { colors: C, statusColors: S } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();

  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modalMode,  setModalMode]  = useState<ModalMode>(null);
  const [amount,     setAmount]     = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const jobs = await getCustomerJobs();
      setRecentJobs(jobs.filter((j) => j.status === 'COMPLETED').slice(0, 5));
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openModal(mode: ModalMode) {
    setAmount('');
    setModalMode(mode);
  }

  async function handleTransaction() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    setProcessing(true);
    try {
      if (modalMode === 'deposit') {
        await addMoney(parsed);
        Alert.alert('Success', `$${parsed.toFixed(2)} added to your wallet.`);
      } else {
        await withdraw(parsed);
        Alert.alert('Success', `$${parsed.toFixed(2)} withdrawn from your wallet.`);
      }
      setModalMode(null);
      setLoading(true);
      await Promise.all([fetchData(), refreshProfile()]);
    } catch (err: any) {
      Alert.alert('Failed', err.message ?? 'Transaction failed. Try again.');
    } finally {
      setProcessing(false);
    }
  }

  const balance = profile?.money_balance ?? 0;
  const totalSpent = recentJobs.reduce((sum, j) => sum + j.price_amount, 0);

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]} edges={['top', 'left', 'right']}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider }]}>
        <TouchableOpacity style={[st.backBtn, { backgroundColor: C.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text2} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={C.blue600} /></View>
      ) : (
        <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {/* Balance card */}
          <View style={[st.balanceCard, { backgroundColor: C.blue700 }]}>
            <Text style={st.balanceLabel}>Available Balance</Text>
            <Text style={st.balanceValue}>${Number(balance).toFixed(2)}</Text>
            <Text style={st.balanceSub}>CleanOps Wallet</Text>

            <View style={st.walletActions}>
              <TouchableOpacity style={[st.walletBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => openModal('deposit')}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={st.walletBtnText}>Deposit</Text>
              </TouchableOpacity>
              <View style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <TouchableOpacity style={[st.walletBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => openModal('withdraw')}>
                <Ionicons name="arrow-down-circle-outline" size={20} color="#fff" />
                <Text style={st.walletBtnText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary */}
          <View style={st.summaryRow}>
            <View style={[st.summaryCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Ionicons name="checkmark-circle-outline" size={22} color={C.success} />
              <Text style={[st.summaryValue, { color: C.text1 }]}>{recentJobs.length}</Text>
              <Text style={[st.summaryLabel, { color: C.text3 }]}>Completed</Text>
            </View>
            <View style={[st.summaryCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Ionicons name="cash-outline" size={22} color={C.blue600} />
              <Text style={[st.summaryValue, { color: C.text1 }]}>${(totalSpent / 100).toFixed(2)}</Text>
              <Text style={[st.summaryLabel, { color: C.text3 }]}>Total Spent</Text>
            </View>
          </View>

          {/* How it works */}
          <View style={[st.infoCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <Text style={[st.infoTitle, { color: C.text1 }]}>How payments work</Text>
            {[
              { icon: 'wallet-outline'         as const, text: 'Add funds to your wallet via Deposit.' },
              { icon: 'lock-closed-outline'    as const, text: 'When you book, funds are held in escrow.' },
              { icon: 'checkmark-circle-outline' as const, text: 'Once you approve, funds are released to the cleaner.' },
            ].map((item) => (
              <View key={item.text} style={st.infoRow}>
                <Ionicons name={item.icon} size={18} color={C.blue600} />
                <Text style={[st.infoText, { color: C.text2 }]}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Recent payments */}
          {recentJobs.length > 0 && (
            <View style={st.section}>
              <Text style={[st.sectionTitle, { color: C.text1 }]}>Recent Payments</Text>
              {recentJobs.map((job) => (
                <View key={job.id} style={[st.paymentRow, { backgroundColor: C.surface, borderColor: C.divider }]}>
                  <View>
                    <Text style={[st.paymentId, { color: C.text1 }]}>#{job.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={[st.paymentDate, { color: C.text3 }]}>{new Date(job.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[st.paymentAmount, { color: C.error }]}>−${(job.price_amount / 100).toFixed(2)}</Text>
                    <View style={[st.paidBadge, { backgroundColor: '#ECFDF5' }]}>
                      <Text style={[st.paidBadgeText, { color: C.success }]}>Paid</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Deposit / Withdraw Modal */}
      <Modal visible={!!modalMode} animationType="slide" transparent>
        <KeyboardAvoidingView style={st.modalOverlay} behavior="padding">
          <View style={[st.modalSheet, { backgroundColor: C.surface }]}>
            <View style={[st.modalHeader, { borderBottomColor: C.divider }]}>
              <Text style={[st.modalTitle, { color: C.text1 }]}>
                {modalMode === 'deposit' ? 'Add Funds' : 'Withdraw Funds'}
              </Text>
              <TouchableOpacity onPress={() => setModalMode(null)}>
                <Ionicons name="close" size={22} color={C.text2} />
              </TouchableOpacity>
            </View>
            <View style={st.modalBody}>
              <Text style={[st.fieldLabel, { color: C.text2 }]}>AMOUNT (USD)</Text>
              <View style={[st.inputRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <Text style={[st.dollarSign, { color: C.text2 }]}>$</Text>
                <TextInput
                  style={[st.input, { color: C.text1 }]}
                  placeholder="0.00"
                  placeholderTextColor={C.text3}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              {modalMode === 'withdraw' && balance !== null && (
                <Text style={[st.balanceHint, { color: C.text3 }]}>Available: ${balance.toFixed(2)}</Text>
              )}
              <TouchableOpacity
                style={[st.confirmBtn, { backgroundColor: modalMode === 'deposit' ? C.blue600 : C.success }, processing && st.disabled]}
                onPress={handleTransaction}
                disabled={processing}
              >
                {processing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={st.confirmBtnText}>{modalMode === 'deposit' ? 'Add Funds' : 'Withdraw'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  balanceCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 6 },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  balanceValue: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  balanceSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 8 },
  walletActions:{ flexDirection: 'row', gap: 0, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  walletBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  walletBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
  summaryRow:   { flexDirection: 'row', gap: 12 },
  summaryCard:  { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  infoCard: { borderRadius: 16, padding: 18, gap: 14, borderWidth: 1 },
  infoTitle:{ fontSize: 15, fontWeight: '800', marginBottom: 2 },
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { fontSize: 13, flex: 1, lineHeight: 19 },
  section:  { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  paymentRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1 },
  paymentId:    { fontSize: 13, fontWeight: '700' },
  paymentDate:  { fontSize: 12 },
  paymentAmount:{ fontSize: 15, fontWeight: '800' },
  paidBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  paidBadgeText:{ fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle:   { fontSize: 18, fontWeight: '800' },
  modalBody:    { padding: 20, gap: 12, paddingBottom: 36 },
  fieldLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  inputRow:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 56, gap: 4 },
  dollarSign:   { fontSize: 22, fontWeight: '700' },
  input:        { flex: 1, fontSize: 22, fontWeight: '700' },
  balanceHint:  { fontSize: 13, textAlign: 'right' },
  confirmBtn:   { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  disabled:     { opacity: 0.5 },
});
