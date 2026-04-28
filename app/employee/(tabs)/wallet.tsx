import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView,
  Platform, RefreshControl, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { getBalance, withdraw, getTransactions } from '@/actions/payments';
import { getPlatformFee } from '@/actions/config';
import { getEmployeeJobs } from '@/actions/jobs';
import { useAuth } from '@/lib/authContext';
import { getPaymentMethods, addPaymentMethod, setDefaultPaymentMethod, removePaymentMethod } from '@/stores/paymentStore';
import { 
  isValidCardNumber, isValidExpiry, isValidCVC, isValidPHMobile, isValidCardholder,
  formatCardNumber, formatExpiry 
} from '@/lib/validation';
import { formatTimeAgo } from '@/lib/utils';

const { width } = Dimensions.get('window');

export default function EmployeeWalletTab() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showManagePayments, setShowManagePayments] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fee, setFee] = useState(15);

  const fetchData = useCallback(async () => {
    try {
      const [txs, methods, feeVal] = await Promise.all([
        getTransactions(),
        getPaymentMethods(),
        getPlatformFee(),
      ]);
      setAllTransactions(txs);
      setPaymentMethods(methods);
      setFee(feeVal);
    } catch (e) {
      if (__DEV__) console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchData();
    refreshProfile();
  }, [fetchData, refreshProfile]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    refreshProfile();
  };

  const balance = profile?.money_balance ?? 0;
  const defaultMethod = paymentMethods.find(m => m.isDefault);

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return Alert.alert('Invalid Amount', 'Please enter a valid amount');
    if (amount > balance) return Alert.alert('Insufficient Funds', 'You cannot withdraw more than your balance');
    if (!defaultMethod) return Alert.alert('No Payment Method', 'Please add a withdrawal method first');

    setIsProcessing(true);
    try {
      await withdraw(amount);
      setShowWithdraw(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      refreshProfile();
      fetchData();
    } catch (e: any) {
      Alert.alert('Withdrawal Failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={st.headerContainer}>
        <LinearGradient
          colors={['#0A0F1E', '#1e293b']}
          style={[st.header, { paddingTop: insets.top + 10 }]}
        >
          <View style={st.headerTop}>
            <Text style={st.headerTitle}>Earnings Wallet</Text>
            <View style={st.proBadge}>
              <Ionicons name="flash" size={10} color="#22c55e" />
              <Text style={st.proText}>PRO</Text>
            </View>
          </View>

          <View style={st.balanceBox}>
            <Text style={st.balanceLabel}>Available for Withdrawal</Text>
            <Text style={st.balanceValue}>${Number(balance).toFixed(2)}</Text>
          </View>

          <TouchableOpacity 
            style={st.withdrawBtn} 
            onPress={() => setShowWithdraw(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
            <Text style={st.withdrawBtnText}>Withdraw Earnings</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <ScrollView 
        style={st.content} 
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue600} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[st.sectionTitle, { color: C.text1 }]}>Transaction History</Text>
        <View style={[st.txCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
          {allTransactions.length === 0 ? (
            <View style={st.emptyTx}>
              <Ionicons name="receipt-outline" size={32} color={C.text3} />
              <Text style={{ color: C.text3, marginTop: 8 }}>No activity yet</Text>
            </View>
          ) : (
            allTransactions.map((tx: any) => {
              const isPositive = ['PAYOUT', 'TOP_UP', 'REFUND'].includes(tx.type);
              
              let iconName: any = 'receipt-outline';
              let iconColor = C.text3;
              let bgColor = C.surface2;

              if (tx.type === 'PAYMENT') { iconName = 'cash-outline'; iconColor = '#ef4444'; bgColor = '#fff1f2'; }
              if (tx.type === 'PAYOUT') { iconName = 'add-outline'; iconColor = '#22c55e'; bgColor = '#f0fdf4'; }
              if (tx.type === 'TOP_UP') { iconName = 'add-outline'; iconColor = C.blue600; bgColor = isDark ? C.blue800 + '20' : '#eff6ff'; }
              if (tx.type === 'REFUND') { iconName = 'refresh-outline'; iconColor = '#22c55e'; bgColor = '#f0fdf4'; }
              if (tx.type === 'WITHDRAWAL') { iconName = 'arrow-up-outline'; iconColor = '#ef4444'; bgColor = '#fff1f2'; }

              return (
                <View key={tx.id} style={[st.txRow, { borderBottomColor: C.divider }]}>
                  <View style={[st.txIcon, { backgroundColor: bgColor }]}>
                    <Ionicons name={iconName} size={18} color={iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.txTitle, { color: C.text1 }]}>
                      {tx.description}
                    </Text>
                    <Text style={[st.txDate, { color: C.text3 }]}>
                      {formatTimeAgo(tx.created_at)}
                    </Text>
                  </View>
                  <Text style={[st.txAmt, { color: isPositive ? '#22c55e' : '#ef4444' }]}>
                    {isPositive ? '+' : '-'}${Math.abs(Number(tx.amount)).toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={[st.infoNote, { backgroundColor: isDark ? C.surface2 : '#f8fafc', borderColor: C.divider }]}>
           <Ionicons name="information-circle" size={18} color={C.text3} />
           <Text style={[st.infoNoteText, { color: C.text3 }]}>
             Earnings are released after customer approval. A {fee}% platform fee applies to all jobs.
           </Text>
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdraw} transparent animationType="slide">
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => !isProcessing && setShowWithdraw(false)}>
           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View style={[st.modalSheet, { backgroundColor: C.surface }]} onStartShouldSetResponder={() => true}>
                 <View style={st.modalHeader}>
                    <Text style={[st.modalTitle, { color: C.text1 }]}>Withdraw Funds</Text>
                    <TouchableOpacity onPress={() => setShowWithdraw(false)}>
                       <Ionicons name="close" size={24} color={C.text1} />
                    </TouchableOpacity>
                 </View>
                 
                 <View style={st.modalBody}>
                    <Text style={[st.inputLabel, { color: C.text3 }]}>Amount to Withdraw</Text>
                    <View style={[st.amountInputRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                       <Text style={[st.currency, { color: C.text3 }]}>$</Text>
                       <TextInput 
                         style={[st.amountInput, { color: C.text1 }]}
                         keyboardType="decimal-pad"
                         value={withdrawAmount}
                         onChangeText={setWithdrawAmount}
                         autoFocus
                       />
                    </View>
                    <Text style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>Available: ${balance.toFixed(2)}</Text>

                    {defaultMethod ? (
                      <View style={[st.methodBox, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                         <Ionicons name="card" size={20} color={C.blue600} />
                         <Text style={[st.methodText, { color: C.text1 }]}>{defaultMethod.brand} •••• {defaultMethod.last4}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={st.addMethodBtn} onPress={() => { setShowWithdraw(false); setShowManagePayments(true); }}>
                         <Text style={{ color: C.blue600, fontWeight: '700' }}>Add Withdrawal Method</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity 
                      style={[st.confirmBtn, { backgroundColor: '#22c55e' }, isProcessing && { opacity: 0.7 }]} 
                      onPress={handleWithdraw}
                      disabled={isProcessing}
                    >
                       {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.confirmBtnText}>Confirm Withdrawal</Text>}
                    </TouchableOpacity>
                 </View>
              </View>
           </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={st.successOverlay}>
          <View style={[st.successModal, { backgroundColor: C.surface }]}>
            <View style={[st.successIconCircle, { backgroundColor: '#22c55e' }]}>
              <Ionicons name="checkmark" size={32} color="#fff" />
            </View>
            <Text style={[st.successTitle, { color: C.text1 }]}>Success!</Text>
            <Text style={[st.successSubText, { color: C.text3 }]}>Your withdrawal is being processed.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { height: 300, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  header: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  proText: { fontSize: 10, fontWeight: '900', color: '#22c55e', letterSpacing: 1 },
  balanceBox: { marginTop: 10 },
  balanceLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  balanceValue: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  withdrawBtn: { height: 56, backgroundColor: '#22c55e', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  withdrawBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  txCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 14, fontWeight: '700' },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmt: { fontSize: 15, fontWeight: '800', marginLeft: 'auto' },
  emptyTx: { padding: 40, alignItems: 'center' },
  infoNote: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, marginTop: 24, gap: 12, alignItems: 'center' },
  infoNoteText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalBody: { gap: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700' },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 16, borderWidth: 1, paddingHorizontal: 20 },
  currency: { fontSize: 24, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  methodBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  methodText: { fontSize: 14, fontWeight: '600' },
  addMethodBtn: { padding: 16, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#3b82f6', borderRadius: 16 },
  confirmBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  successModal: { width: width * 0.8, padding: 32, borderRadius: 32, alignItems: 'center', gap: 16 },
  successIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontWeight: '800' },
  successSubText: { fontSize: 14, textAlign: 'center' },
});
