import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView,
  Platform, RefreshControl, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { addMoney, withdraw } from '@/actions/payments';
import { getEmployeeJobs } from '@/actions/jobs';
import { formatTimeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';
import { 
  getPaymentMethods, addPaymentMethod, setDefaultPaymentMethod, removePaymentMethod,
  getWithdrawals, addWithdrawal
} from '@/stores/employeePaymentStore';
import { 
  isValidCardNumber, isValidExpiry, isValidCVC, isValidPHMobile, isValidCardholder,
  formatCardNumber, formatExpiry 
} from '@/lib/validation';
import type { Job, PaymentMethod, PaymentBrand, WithdrawalTransaction } from '@/types';

const { width } = Dimensions.get('window');

export default function EmployeeWalletTab() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalTransaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showWithdrawMoney, setShowWithdrawMoney] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showManagePayments, setShowManagePayments] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [depositAmount, setDepositAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [cardBrand, setCardBrand] = useState<PaymentBrand>('Visa');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [paymentFlow, setPaymentFlow] = useState<'details' | 'otp'>('details');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [jobs, methods, history] = await Promise.all([
        getEmployeeJobs('COMPLETED'),
        getPaymentMethods(),
        getWithdrawals(),
      ]);
      setRecentJobs(jobs);
      setPaymentMethods(methods);
      setWithdrawals(history);
    } catch (e) {
      console.warn('Wallet fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    refreshProfile();
  };

  const balance = profile?.money_balance ?? 0;
  // We'll keep the pending earnings logic but fetch specifically for it if needed, 
  // though per your instruction we focus on completed ones for history.
  const pendingEarnings = 0; // Simplified as we are only showing completed history now

  const defaultMethod = useMemo(() => {
    // Show cards OR wallets
    return paymentMethods.find(m => m.isDefault) || paymentMethods[0];
  }, [paymentMethods]);

  const allTransactions = useMemo(() => {
    const combined = [
      ...recentJobs.map(j => ({ ...j, type: 'job' as const })),
      ...withdrawals.map(w => ({ ...w, type: 'withdraw' as const })),
    ];
    return combined.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [recentJobs, withdrawals]);

  // -- Handlers --
  function resetPaymentForm() {
    setCardNumber('');
    setExpiry('');
    setCvc('');
    setCardholderName('');
    setPhoneNumber('');
    setOtp('');
    setPaymentFlow('details');
    setErrors({});
  }

  async function handleAddPaymentMethod() {
    const isCard = cardBrand === 'Visa' || cardBrand === 'Mastercard';
    const newErrors: Record<string, string> = {};

    if (isCard) {
      if (!isValidCardNumber(cardNumber)) newErrors.cardNumber = 'Invalid 16-digit card number';
      if (!isValidExpiry(expiry)) newErrors.expiry = 'Invalid or expired (MM/YY)';
      if (!isValidCVC(cvc)) newErrors.cvc = 'Invalid CVC';
      if (!isValidCardholder(cardholderName)) newErrors.cardholderName = 'Invalid name';

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setIsProcessing(true);
      try {
        await addPaymentMethod({
          type: 'card',
          brand: cardBrand,
          last4: cardNumber.replace(/\s+/g, '').slice(-4),
          expiry,
          cardholderName,
        });
        await fetchData();
        setShowAddPayment(false);
        resetPaymentForm();
        toast.show(`${cardBrand} added successfully`);
      } catch (e) {
        Alert.alert('Error', 'Failed to add card');
      } finally {
        setIsProcessing(false);
      }
    } else {
      // E-Wallet flow
      if (!isValidPHMobile(phoneNumber)) {
        setErrors({ phoneNumber: 'Must be 10 digits starting with 9' });
        return;
      }
      setErrors({});
      setIsProcessing(true);
      // Simulate OTP step for Maya/GCash
      setTimeout(() => {
        setIsProcessing(false);
        setPaymentFlow('otp');
      }, 1500);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      setErrors({ otp: 'Enter 6-digit code' });
      return;
    }
    setIsProcessing(true);
    try {
      // In a real app, verify OTP with Supabase/Stripe
      await addPaymentMethod({
        type: 'e-wallet',
        brand: cardBrand,
        last4: phoneNumber.slice(-4),
        phoneNumber: phoneNumber,
      });
      await fetchData();
      setShowAddPayment(false);
      resetPaymentForm();
      toast.show(`${cardBrand} linked successfully`);
    } catch (e) {
      Alert.alert('Error', 'Failed to link wallet');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRemoveMethod(id: string) {
    Alert.alert('Remove Method?', 'Are you sure you want to remove this payout method?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await removePaymentMethod(id);
        await fetchData();
        toast.show('Method removed');
      }},
    ]);
  }

  async function handleSetDefault(id: string) {
    await setDefaultPaymentMethod(id);
    await fetchData();
    toast.show('Default payout method updated');
  }

  async function handleWithdraw() {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) return Alert.alert('Invalid', 'Enter valid amount');
    if (amt > balance) return Alert.alert('Insufficient', 'Balance too low');
    if (!defaultMethod) return Alert.alert('Error', 'Please add a payout method first');
    
    setIsProcessing(true);
    try {
      await withdraw(amt);
      await addWithdrawal(amt, defaultMethod);
      await refreshProfile();
      await fetchData();
      setShowWithdrawMoney(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setIsProcessing(false); }
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={st.headerContainer}>
        <LinearGradient
          colors={['#0A0F1E', '#1e293b']}
          style={[st.balanceCard, { paddingTop: insets.top + 10 }]}
        >
          <View style={st.headerTop}>
            <View>
              <Text style={st.headerTitle}>Earnings Wallet</Text>
              <Text style={st.headerSub}>Manage your payouts</Text>
            </View>
            <View style={st.proBadge}>
              <Ionicons name="flash" size={12} color="#22c55e" />
              <Text style={st.proText}>PRO</Text>
            </View>
          </View>

          <View style={st.balanceMain}>
            <Text style={st.balanceLabel}>Available for Withdrawal</Text>
            <Text style={st.balanceValue}>${Number(balance).toFixed(2)}</Text>
          </View>

          <View style={st.actionButtonsRow}>
            <TouchableOpacity style={st.primaryBtn} onPress={() => setShowWithdrawMoney(true)}>
              <Ionicons name="arrow-up" size={18} color="#fff" />
              <Text style={st.btnText}>Withdraw Earnings</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={st.content} 
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue600} />}
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
              const isJob = tx.type === 'job';
              return (
                <View key={tx.id} style={[st.txRow, { borderBottomColor: C.divider }]}>
                  <View style={[st.txIcon, { backgroundColor: isJob ? (tx.status === 'COMPLETED' ? '#f0fdf4' : '#f1f5f9') : '#fff1f2' }]}>
                    <Ionicons 
                      name={isJob ? (tx.status === 'COMPLETED' ? 'cash-outline' : 'time-outline') : 'arrow-up-outline'} 
                      size={18} 
                      color={isJob ? (tx.status === 'COMPLETED' ? '#22c55e' : '#64748b') : '#ef4444'} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.txTitle, { color: C.text1 }]}>
                      {isJob ? `${tx.size || 'Cleaning'} Job` : `Payout to ${tx.method_brand}`}
                    </Text>
                    <Text style={[st.txDate, { color: C.text3 }]}>
                      {isJob ? formatTimeAgo(tx.created_at) : formatTimeAgo(tx.created_at)}
                      {!isJob && ` (**** ${tx.method_last4})`}
                    </Text>
                  </View>
                  <Text style={[st.txAmt, { color: isJob ? '#22c55e' : '#ef4444' }]}>
                    {isJob ? '+' : '-'}${(isJob ? (Number(tx.price_amount) * 0.9) : tx.amount).toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={[st.infoNote, { backgroundColor: C.surface2, borderColor: C.divider }]}>
           <Ionicons name="information-circle" size={16} color={C.text3} />
           <Text style={[st.infoNoteText, { color: C.text3 }]}>
             Earnings are released after customer approval. A 10% platform fee applies to all jobs.
           </Text>
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawMoney} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: C.surface }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: C.text1 }]}>Withdraw Earnings</Text>
              <TouchableOpacity onPress={() => setShowWithdrawMoney(false)}>
                <Ionicons name="close" size={24} color={C.text3} />
              </TouchableOpacity>
            </View>

            <View style={st.modalBody}>
              <Text style={[st.inputLabel, { color: C.text2 }]}>Amount to Withdraw</Text>
              <View style={[st.amountInputWrap, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <Text style={[st.currencySymbol, { color: C.text1 }]}>$</Text>
                <TextInput
                  style={[st.amountInput, { color: C.text1 }]}
                  keyboardType="numeric"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  autoFocus
                />
              </View>
              <Text style={[st.balanceNote, { color: C.text3 }]}>Available: ${balance.toFixed(2)}</Text>

              {defaultMethod ? (
                <>
                  <Text style={[st.inputLabel, { color: C.text2, marginTop: 20 }]}>Transfer to</Text>
                  <TouchableOpacity 
                    style={[st.methodBtn, { backgroundColor: C.surface2, borderColor: C.divider }]}
                    onPress={() => setShowManagePayments(true)}
                  >
                    <View style={[st.methodBrandIconSmall, { backgroundColor: defaultMethod.brand === 'Visa' ? '#1d4ed8' : (defaultMethod.brand === 'Mastercard' ? '#1a1a1a' : (defaultMethod.brand === 'Maya' ? '#00c300' : '#1a73e8')) }]}>
                      <Text style={st.brandTextTiny}>{defaultMethod.brand.substring(0, 2)}</Text>
                    </View>
                    <Text style={[st.methodText, { color: C.text1 }]}>
                      {defaultMethod.brand} {defaultMethod.last4 ? `(**** ${defaultMethod.last4})` : (defaultMethod.phoneNumber ? `(+63 ${defaultMethod.phoneNumber.slice(-4)})` : '')}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={C.text3} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  style={[st.methodBtn, { backgroundColor: C.surface2, borderColor: C.error, borderStyle: 'dashed', marginTop: 24 }]}
                  onPress={() => setShowAddPayment(true)}
                >
                   <Ionicons name="add-circle-outline" size={20} color={C.error} />
                   <Text style={[st.methodText, { color: C.error }]}>Add Payout Method</Text>
                   <Ionicons name="chevron-forward" size={16} color={C.text3} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={[st.withdrawConfirmBtn, { backgroundColor: (defaultMethod && !isProcessing) ? '#22c55e' : '#94a3b8' }]} 
              onPress={handleWithdraw}
              disabled={!defaultMethod || isProcessing}
            >
              {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.withdrawConfirmText}>Confirm Withdrawal</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: MANAGE PAYMENTS */}
      <Modal visible={showManagePayments} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: C.surface }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: C.text1 }]}>Manage Payouts</Text>
              <TouchableOpacity onPress={() => setShowManagePayments(false)}>
                <Ionicons name="close" size={24} color={C.text3} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ gap: 12 }}>
                {paymentMethods.map(m => (
                  <View key={m.id} style={[st.methodRow, { backgroundColor: C.surface2, borderColor: m.isDefault ? C.blue600 : C.divider }]}>
                    <TouchableOpacity 
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                      onPress={() => handleSetDefault(m.id)}
                    >
                      <View style={[st.methodBrandIconSmall, { width: 32, height: 22, backgroundColor: m.brand === 'Visa' ? '#1d4ed8' : (m.brand === 'Mastercard' ? '#1a1a1a' : (m.brand === 'Maya' ? '#00c300' : '#1a73e8')) }]}>
                        <Text style={[st.brandTextTiny, { fontSize: 9 }]}>{m.brand.substring(0, 2)}</Text>
                      </View>
                      <View>
                        <Text style={[st.methodText, { color: C.text1 }]}>
                          {m.brand} {m.last4 ? `(**** ${m.last4})` : (m.phoneNumber ? `(+63 ${m.phoneNumber.slice(-4)})` : '')}
                        </Text>
                        {m.isDefault && <Text style={{ fontSize: 10, color: C.blue600, fontWeight: '700' }}>DEFAULT</Text>}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveMethod(m.id)}>
                      <Ionicons name="trash-outline" size={18} color={C.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity 
                  style={[st.methodRow, { borderStyle: 'dashed', borderColor: C.blue600, justifyContent: 'center' }]}
                  onPress={() => { setShowManagePayments(false); setShowAddPayment(true); }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={C.blue600} />
                  <Text style={[st.methodText, { color: C.blue600 }]}>Add New Payout Method</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: ADD PAYMENT METHOD */}
      <Modal visible={showAddPayment} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: C.surface }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: C.text1 }]}>
                {paymentFlow === 'otp' ? `Link ${cardBrand}` : 'Add Payout Method'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddPayment(false)}>
                <Ionicons name="close" size={24} color={C.text3} />
              </TouchableOpacity>
            </View>

            <View style={st.modalBody}>
              {paymentFlow === 'details' ? (
                <>
                  <Text style={[st.inputLabel, { color: C.text2 }]}>Select Method</Text>
                  <View style={st.brandSelector}>
                    {(['Visa', 'Mastercard', 'Maya', 'GCash'] as PaymentBrand[]).map(b => (
                      <TouchableOpacity 
                        key={b}
                        style={[
                          st.brandOption, 
                          cardBrand === b && { borderColor: C.blue600, backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#f0f9ff' }
                        ]}
                        onPress={() => { setCardBrand(b); setErrors({}); }}
                      >
                        <Text style={[st.brandOptionText, { color: cardBrand === b ? C.blue600 : C.text2 }]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {cardBrand === 'Visa' || cardBrand === 'Mastercard' ? (
                    <View style={{ marginTop: 20, gap: 16 }}>
                      <View style={st.inputSection}>
                        <Text style={[st.inputLabel, { color: C.text2 }]}>Cardholder Name</Text>
                        <View style={[st.amountInputWrap, { backgroundColor: C.surface2, borderColor: errors.cardholderName ? C.error : C.divider }]}>
                          <TextInput
                            style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                            placeholder="John Doe"
                            placeholderTextColor={C.text3}
                            value={cardholderName}
                            onChangeText={val => { setCardholderName(val); setErrors(prev => ({ ...prev, cardholderName: '' })); }}
                            autoCapitalize="words"
                          />
                        </View>
                        {errors.cardholderName && <Text style={st.errorText}>{errors.cardholderName}</Text>}
                      </View>

                      <View style={st.inputSection}>
                        <Text style={[st.inputLabel, { color: C.text2 }]}>Card Number</Text>
                        <View style={[st.amountInputWrap, { backgroundColor: C.surface2, borderColor: errors.cardNumber ? C.error : C.divider }]}>
                          <TextInput
                            style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                            placeholder="4242 4242 4242 4242"
                            placeholderTextColor={C.text3}
                            value={formatCardNumber(cardNumber)}
                            onChangeText={val => { setCardNumber(val.replace(/\s+/g, '')); setErrors(prev => ({ ...prev, cardNumber: '' })); }}
                            keyboardType="number-pad"
                            maxLength={19}
                          />
                        </View>
                        {errors.cardNumber && <Text style={st.errorText}>{errors.cardNumber}</Text>}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={[st.inputSection, { flex: 1 }]}>
                          <Text style={[st.inputLabel, { color: C.text2 }]}>Expiry</Text>
                          <View style={[st.amountInputWrap, { backgroundColor: C.surface2, borderColor: errors.expiry ? C.error : C.divider }]}>
                            <TextInput
                              style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                              placeholder="MM/YY"
                              placeholderTextColor={C.text3}
                              value={formatExpiry(expiry)}
                              onChangeText={val => { setExpiry(val); setErrors(prev => ({ ...prev, expiry: '' })); }}
                              maxLength={5}
                            />
                          </View>
                          {errors.expiry && <Text style={st.errorText}>{errors.expiry}</Text>}
                        </View>
                        <View style={[st.inputSection, { flex: 1 }]}>
                          <Text style={[st.inputLabel, { color: C.text2 }]}>CVC</Text>
                          <View style={[st.amountInputWrap, { backgroundColor: C.surface2, borderColor: errors.cvc ? C.error : C.divider }]}>
                            <TextInput
                              style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                              placeholder="123"
                              placeholderTextColor={C.text3}
                              value={cvc}
                              onChangeText={val => { setCvc(val); setErrors(prev => ({ ...prev, cvc: '' })); }}
                              keyboardType="number-pad"
                              maxLength={4}
                              secureTextEntry
                            />
                          </View>
                          {errors.cvc && <Text style={st.errorText}>{errors.cvc}</Text>}
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginTop: 20, gap: 16 }}>
                      <View style={st.inputSection}>
                        <Text style={[st.inputLabel, { color: C.text2 }]}>{cardBrand} Number</Text>
                        <View style={[st.amountInputWrap, { backgroundColor: C.surface2, borderColor: errors.phoneNumber ? C.error : C.divider }]}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text1, marginRight: 8 }}>+63</Text>
                          <TextInput
                            style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                            placeholder="917 123 4567"
                            placeholderTextColor={C.text3}
                            value={phoneNumber}
                            onChangeText={val => { setPhoneNumber(val.replace(/\s+/g, '')); setErrors(prev => ({ ...prev, phoneNumber: '' })); }}
                            keyboardType="phone-pad"
                            maxLength={10}
                          />
                        </View>
                        {errors.phoneNumber && <Text style={st.errorText}>{errors.phoneNumber}</Text>}
                      </View>
                    </View>
                  )}

                  <TouchableOpacity style={[st.withdrawConfirmBtn, { backgroundColor: '#22c55e', marginTop: 24 }]} onPress={handleAddPaymentMethod}>
                    {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.withdrawConfirmText}>Link Payout Method</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ gap: 20, alignItems: 'center' }}>
                  <Text style={[st.modalTitle, { color: C.text1 }]}>Verify OTP</Text>
                  <Text style={{ color: C.text3, textAlign: 'center' }}>Enter the 6-digit code sent to your mobile</Text>
                  <View style={[st.amountInputWrap, { backgroundColor: C.surface2, borderColor: errors.otp ? C.error : C.divider }]}>
                    <TextInput
                      style={[st.amountInput, { color: C.text1, textAlign: 'center', letterSpacing: 8 }]}
                      placeholder="000000"
                      placeholderTextColor={C.text3}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <TouchableOpacity style={[st.withdrawConfirmBtn, { backgroundColor: '#22c55e', width: '100%' }]} onPress={handleVerifyOtp}>
                    {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.withdrawConfirmText}>Verify & Link</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: SUCCESS */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={st.successOverlay}>
          <View style={[st.successModal, { backgroundColor: C.surface }]}>
            <View style={[st.successIconCircle, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            </View>
            <Text style={[st.successTitle, { color: C.text1 }]}>Request Sent</Text>
            <Text style={[st.successSubText, { color: C.text3 }]}>
              Your withdrawal request is being processed. Funds should arrive in 1-3 business days.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modals are kept similar to customer wallet for consistent payment flows */}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { height: 280, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  balanceCard: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  proText: { fontSize: 10, color: '#4ade80', fontWeight: '900' },
  balanceMain: { marginTop: 10 },
  balanceLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  balanceValue: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  pendingText: { fontSize: 13, fontWeight: '600', color: '#fde68a' },
  actionButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 16 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, borderRadius: 16 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  content: { flex: 1, padding: 16, paddingTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  txCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  txIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 14, fontWeight: '700' },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmt: { fontSize: 15, fontWeight: '800' },
  emptyTx: { padding: 40, alignItems: 'center' },
  infoNote: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, marginTop: 24, gap: 10 },
  infoNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalBody: { marginBottom: 32 },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  amountInputWrap: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20 },
  currencySymbol: { fontSize: 24, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '800' },
  balanceNote: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  methodBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  methodText: { fontSize: 14, fontWeight: '600' },
  withdrawConfirmBtn: { height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  withdrawConfirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // New Styles
  methodBrandIconSmall: {
    width: 40,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextTiny: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  brandSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  brandOptionText: { fontSize: 13, fontWeight: '600' },
  methodRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  inputSection: { gap: 8 },
  errorText: { color: '#ef4444', fontSize: 11, fontWeight: '600', marginTop: 4 },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  successModal: { width: width * 0.8, padding: 30, borderRadius: 32, alignItems: 'center', gap: 16 },
  successIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontWeight: '800' },
  successSubText: { fontSize: 14, textAlign: 'center' },
});
