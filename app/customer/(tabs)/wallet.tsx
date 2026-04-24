import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView,
  Platform, RefreshControl, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { addMoney, getBalance, withdraw } from '@/actions/payments';
import { getCustomerJobs } from '@/actions/jobs';
import { useAuth } from '@/lib/authContext';
import { getPaymentMethods, addPaymentMethod, setDefaultPaymentMethod, removePaymentMethod } from '@/stores/paymentStore';
import { 
  isValidCardNumber, isValidExpiry, isValidCVC, isValidPHMobile, isValidCardholder,
  formatCardNumber, formatExpiry 
} from '@/lib/validation';
import type { Job, PaymentMethod, PaymentBrand } from '@/types';

const { width, height } = Dimensions.get('window');

export default function CustomerWalletTab() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();

  // -- State --
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // Modals
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showWithdrawMoney, setShowWithdrawMoney] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Forms
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
      const [jobs, methods] = await Promise.all([
        getCustomerJobs(),
        getPaymentMethods(),
      ]);
      setRecentJobs(jobs);
      setPaymentMethods(methods);
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

  // -- Computed --
  const balance = profile?.money_balance ?? 0;
  const escrowHeld = useMemo(() => {
    return recentJobs
      .filter(j => j.status === 'OPEN' || j.status === 'IN_PROGRESS' || j.status === 'PENDING_REVIEW')
      .reduce((sum, j) => sum + Number(j.price_amount), 0);
  }, [recentJobs]);

  const totalDeposited = useMemo(() => {
    // Approximate: current balance + all job payments (spent + held in escrow)
    return balance + recentJobs.reduce((sum, j) => sum + Number(j.price_amount), 0);
  }, [balance, recentJobs]);
  const totalSpent = useMemo(() => {
    return recentJobs
      .filter(j => j.status === 'COMPLETED')
      .reduce((sum, j) => sum + Number(j.price_amount), 0);
  }, [recentJobs]);

  const defaultMethod = paymentMethods.find(m => m.isDefault);

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
      // Simulate "Sending OTP"
      setTimeout(() => {
        setIsProcessing(false);
        setPaymentFlow('otp');
      }, 1500);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) {
      setErrors({ otp: 'Please enter 6-digit code' });
      return;
    }
    setIsProcessing(true);
    try {
      await addPaymentMethod({
        type: 'e-wallet',
        brand: cardBrand,
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

  async function handleAddMoney() {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    if (!defaultMethod) {
      Alert.alert('No Payment Method', 'Please add a payment method first', [
        { text: 'Add Now', onPress: () => { setShowAddMoney(false); setShowAddPayment(true); } },
        { text: 'Cancel' }
      ]);
      return;
    }

    setIsProcessing(true);
    try {
      await addMoney(amount);
      await refreshProfile();
      await fetchData();
      setShowAddMoney(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) {
      Alert.alert('Transaction Failed', e.message || 'Could not complete top-up');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleWithdrawMoney() {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    if (amount > balance) {
      Alert.alert('Insufficient Balance', `You only have $${balance.toFixed(2)} available for withdrawal.`);
      return;
    }
    if (!defaultMethod) {
      Alert.alert('No Payment Method', 'Please add a payment method to receive your funds.');
      return;
    }

    setIsProcessing(true);
    try {
      await withdraw(amount);
      await refreshProfile();
      await fetchData();
      setShowWithdrawMoney(false);
      toast.show(`$${amount.toFixed(2)} withdrawn successfully`);
    } catch (e: any) {
      Alert.alert('Withdrawal Failed', e.message || 'Could not complete withdrawal');
    } finally {
      setIsProcessing(false);
    }
  }

  const renderTransaction = (job: Job) => {
    let icon = 'cash-outline';
    let color = C.blue600;
    let title = job.size || 'Cleaning Service';
    let amount = Number(job.price_amount).toFixed(2);
    let status = 'Paid';
    let sign = '-';

    if (job.status === 'CANCELLED') {
      icon = 'refresh-outline';
      color = C.success;
      title = `Refund: ${title} (cancelled)`;
      sign = '+';
      status = 'Deposit';
    } else if (job.status === 'OPEN' || job.status === 'IN_PROGRESS' || job.status === 'PENDING_REVIEW') {
      icon = 'lock-closed-outline';
      color = '#d97706';
      title = `Escrow Held: ${title}`;
      sign = '-';
      status = 'Held';
    }

    return (
      <View key={job.id} style={[st.txRow, { borderBottomColor: C.divider }]}>
        <View style={[st.txIconContainer, { backgroundColor: job.status === 'CANCELLED' ? '#f0fdf4' : (job.status === 'COMPLETED' ? '#fef2f2' : '#fffbeb') }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <View style={st.txInfo}>
          <Text style={[st.txTitle, { color: C.text1 }]} numberOfLines={1}>{title}</Text>
          <Text style={[st.txDate, { color: C.text3 }]}>{new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        </View>
        <View style={st.txAmountContainer}>
          <Text style={[st.txAmount, { color: sign === '+' ? C.success : (status === 'Held' ? '#d97706' : C.error) }]}>
            {sign}${amount}
          </Text>
          <Text style={[st.txStatus, { color: C.text3 }]}>{status}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      {/* Header Card */}
      <View style={st.headerContainer}>
        <LinearGradient
          colors={['#0c4a6e', '#0284c7']}
          style={[st.balanceCard, { paddingTop: insets.top + 10 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={st.headerTop}>
            <View>
              <Text style={st.headerTitle}>Wallet</Text>
              <Text style={st.headerSub}>Secure escrow payments</Text>
            </View>
            <View style={st.protectedBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#4ade80" />
              <Text style={st.protectedText}>Protected</Text>
            </View>
          </View>

          <View style={st.balanceMain}>
            <Text style={st.balanceLabel}>Available Balance</Text>
            <Text style={st.balanceValue}>${Number(balance).toFixed(2)}</Text>
            <View style={st.escrowRow}>
              <Ionicons name="time-outline" size={14} color="#fde68a" />
              <Text style={st.escrowText}>${escrowHeld.toFixed(2)} held in escrow</Text>
            </View>
          </View>

          <View style={st.actionButtonsRow}>
            <TouchableOpacity 
              style={st.addMoneyBtn} 
              onPress={() => setShowAddMoney(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={st.addMoneyBtnText}>Add Money</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={st.withdrawBtn} 
              onPress={() => setShowWithdrawMoney(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
              <Text style={st.addMoneyBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={st.content} 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue600} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Row */}
        <View style={st.statsRow}>
          <View style={[st.statCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={st.statHeader}>
              <View style={[st.statIconBox, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="arrow-down-outline" size={14} color={C.success} />
              </View>
              <Text style={[st.statLabel, { color: C.text3 }]}>Total Deposited</Text>
            </View>
            <Text style={[st.statValue, { color: C.text1 }]}>${totalDeposited.toFixed(2)}</Text>
          </View>
          <View style={[st.statCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={st.statHeader}>
              <View style={[st.statIconBox, { backgroundColor: '#fef2f2' }]}>
                <Ionicons name="arrow-up-outline" size={14} color={C.error} />
              </View>
              <Text style={[st.statLabel, { color: C.text3 }]}>Total Spent</Text>
            </View>
            <Text style={[st.statValue, { color: C.text1 }]}>${totalSpent.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Payment Methods</Text>
          <View style={st.methodList}>
            {paymentMethods.map(method => (
              <View 
                key={method.id} 
                style={[st.methodCard, { backgroundColor: C.surface, borderColor: C.divider }]}
              >
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => {
                    if (!method.isDefault) {
                      setDefaultPaymentMethod(method.id).then(fetchData);
                    }
                  }}
                >
                  <View style={[st.methodBrandIcon, { backgroundColor: method.brand === 'Visa' ? '#1d4ed8' : (method.brand === 'Mastercard' ? '#1a1a1a' : (method.brand === 'Maya' ? '#00c300' : '#1a73e8')) }]}>
                    <Text style={st.brandTextShort}>{method.brand.substring(0, 2)}</Text>
                  </View>
                  <View style={st.methodInfo}>
                    <Text style={[st.methodName, { color: C.text1 }]}>
                      {method.brand} {method.last4 ? `····${method.last4}` : (method.phoneNumber ? `+63 ${method.phoneNumber.slice(-4)}` : '')}
                    </Text>
                    <Text style={[st.methodSub, { color: C.text3 }]}>
                      {method.expiry ? `Expires ${method.expiry}` : 'Linked Account'}
                    </Text>
                  </View>
                  {method.isDefault && (
                    <View style={st.defaultBadge}>
                      <Text style={st.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={st.removeBtn} 
                  onPress={() => {
                    Alert.alert('Remove Method', `Are you sure you want to remove your ${method.brand}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', onPress: () => { removePaymentMethod(method.id).then(fetchData); }, style: 'destructive' }
                    ]);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={C.text3} />
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity 
              style={[st.addMethodBtn, { borderColor: C.text3 }]} 
              onPress={() => setShowAddPayment(true)}
            >
              <Ionicons name="add" size={18} color={C.text3} />
              <Text style={[st.addMethodBtnText, { color: C.text3 }]}>Add Payment Method</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Transaction History</Text>
          <View style={[st.txCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
            {recentJobs.length === 0 ? (
              <View style={st.emptyTx}>
                <Ionicons name="receipt-outline" size={32} color={C.text3} />
                <Text style={{ color: C.text3, marginTop: 8 }}>No transactions yet</Text>
              </View>
            ) : (
              recentJobs.map(renderTransaction)
            )}
          </View>
        </View>

        {/* Escrow Note */}
        <View style={[st.escrowNote, { backgroundColor: C.surface2, borderColor: C.divider }]}>
          <Ionicons name="information-circle-outline" size={16} color={C.text3} />
          <Text style={[st.escrowNoteText, { color: C.text3 }]}>
            Payments are held in escrow and released only after you approve completed work. Platform fee: 10%.
          </Text>
        </View>
      </ScrollView>

      {/* MODAL: ADD MONEY */}
      <Modal visible={showAddMoney} animationType="slide" transparent>
        <TouchableOpacity 
          style={st.modalOverlay} 
          activeOpacity={1} 
          onPress={() => !isProcessing && setShowAddMoney(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={st.modalAvoid}
          >
            <View style={[st.modalSheet, { backgroundColor: C.surface }]} onStartShouldSetResponder={() => true}>
              <View style={st.modalHeader}>
                <Text style={[st.modalTitle, { color: C.text1 }]}>Add Money</Text>
                <TouchableOpacity onPress={() => setShowAddMoney(false)} disabled={isProcessing}>
                  <View style={st.closeBtn}>
                    <Ionicons name="close" size={20} color={C.text2} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={st.modalBody}>
                <View style={st.presetsRow}>
                  {['25', '50', '100', '250'].map(amt => (
                    <TouchableOpacity 
                      key={amt}
                      style={[
                        st.presetBtn, 
                        depositAmount === amt ? { backgroundColor: '#e0f2fe', borderColor: C.blue600 } : { backgroundColor: '#f1f5f9', borderColor: 'transparent' }
                      ]}
                      onPress={() => setDepositAmount(amt)}
                    >
                      <Text style={[st.presetText, depositAmount === amt ? { color: C.blue600 } : { color: C.text2 }]}>${amt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={st.inputSection}>
                  <Text style={[st.inputLabel, { color: C.text3 }]}>Custom Amount</Text>
                  <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={st.currencySymbol}>$</Text>
                    <TextInput
                      style={[st.amountInput, { color: C.text1 }]}
                      keyboardType="decimal-pad"
                      value={depositAmount}
                      onChangeText={setDepositAmount}
                      placeholder="0.00"
                      placeholderTextColor={C.text3}
                    />
                  </View>
                </View>

                {defaultMethod ? (
                  <View style={[st.selectedMethod, { backgroundColor: '#f8fafc', borderColor: C.divider }]}>
                    <View style={[st.methodBrandIconSmall, { backgroundColor: defaultMethod.brand === 'Visa' ? '#1d4ed8' : '#1a1a1a' }]}>
                      <Text style={st.brandTextTiny}>{defaultMethod.brand.substring(0, 2)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.methodNameSmall, { color: C.text1 }]}>{defaultMethod.brand} ····{defaultMethod.last4}</Text>
                      <Text style={[st.methodSubSmall, { color: C.text3 }]}>Expires {defaultMethod.expiry}</Text>
                    </View>
                    <Text style={st.defaultLabelSmall}>Default</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={st.noMethodLink}
                    onPress={() => { setShowAddMoney(false); setShowAddPayment(true); }}
                  >
                    <Text style={st.noMethodText}>Add a payment method to continue</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[st.confirmBtn, !defaultMethod && { opacity: 0.5 }]} 
                  onPress={handleAddMoney}
                  disabled={isProcessing || !defaultMethod}
                >
                  <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={st.confirmBtnText}>Add ${parseFloat(depositAmount || '0').toFixed(2)}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: WITHDRAW MONEY */}
      <Modal visible={showWithdrawMoney} animationType="slide" transparent>
        <TouchableOpacity 
          style={st.modalOverlay} 
          activeOpacity={1} 
          onPress={() => !isProcessing && setShowWithdrawMoney(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={st.modalAvoid}
          >
            <View style={[st.modalSheet, { backgroundColor: C.surface }]} onStartShouldSetResponder={() => true}>
              <View style={st.modalHeader}>
                <Text style={[st.modalTitle, { color: C.text1 }]}>Withdraw Funds</Text>
                <TouchableOpacity onPress={() => setShowWithdrawMoney(false)} disabled={isProcessing}>
                  <View style={st.closeBtn}>
                    <Ionicons name="close" size={20} color={C.text2} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={st.modalBody}>
                <View style={st.inputSection}>
                  <Text style={[st.inputLabel, { color: C.text3 }]}>Withdrawal Amount</Text>
                  <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }, parseFloat(withdrawAmount) > balance && { borderColor: C.error, borderWidth: 1 }]}>
                    <Text style={st.currencySymbol}>$</Text>
                    <TextInput
                      style={[st.amountInput, { color: C.text1 }]}
                      keyboardType="decimal-pad"
                      value={withdrawAmount}
                      onChangeText={setWithdrawAmount}
                      placeholder="0.00"
                      placeholderTextColor={C.text3}
                    />
                  </View>
                  {parseFloat(withdrawAmount) > balance && (
                    <Text style={{ color: C.error, fontSize: 11, marginTop: 4 }}>
                      Amount exceeds available balance of ${balance.toFixed(2)}
                    </Text>
                  )}
                </View>

                {defaultMethod ? (
                  <View style={[st.selectedMethod, { backgroundColor: '#f8fafc', borderColor: C.divider }]}>
                    <View style={[st.methodBrandIconSmall, { backgroundColor: defaultMethod.brand === 'Visa' ? '#1d4ed8' : '#1a1a1a' }]}>
                      <Text style={st.brandTextTiny}>{defaultMethod.brand.substring(0, 2)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.methodNameSmall, { color: C.text1 }]}>Withdraw to {defaultMethod.brand} ····{defaultMethod.last4}</Text>
                      <Text style={[st.methodSubSmall, { color: C.text3 }]}>Funds usually arrive in 1-3 business days</Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={st.noMethodLink}
                    onPress={() => { setShowWithdrawMoney(false); setShowAddPayment(true); }}
                  >
                    <Text style={st.noMethodText}>Add a withdrawal destination</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[st.confirmBtn, (isProcessing || !defaultMethod || parseFloat(withdrawAmount) > balance || parseFloat(withdrawAmount) <= 0) && { opacity: 0.5 }]} 
                  onPress={handleWithdrawMoney}
                  disabled={isProcessing || !defaultMethod || parseFloat(withdrawAmount) > balance || parseFloat(withdrawAmount) <= 0}
                >
                  <LinearGradient colors={['#64748b', '#334155']} style={st.btnGradient}>
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={st.confirmBtnText}>Withdraw ${parseFloat(withdrawAmount || '0').toFixed(2)}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: ADD PAYMENT METHOD */}
      <Modal visible={showAddPayment} animationType="slide" transparent>
        <TouchableOpacity 
          style={st.modalOverlay} 
          activeOpacity={1} 
          onPress={() => !isProcessing && setShowAddPayment(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={st.modalAvoid}
          >
            <View style={[st.modalSheet, { backgroundColor: C.surface }]} onStartShouldSetResponder={() => true}>
              <View style={st.modalHeader}>
                <Text style={[st.modalTitle, { color: C.text1 }]}>
                  {paymentFlow === 'otp' ? `Link ${cardBrand}` : 'Add Payment Method'}
                </Text>
                <TouchableOpacity onPress={() => setShowAddPayment(false)} disabled={isProcessing}>
                  <View style={st.closeBtn}>
                    <Ionicons name="close" size={20} color={C.text2} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={st.modalBody}>
                {paymentFlow === 'details' ? (
                  <>
                    <Text style={[st.inputLabel, { color: C.text3 }]}>Select Brand</Text>
                    <View style={st.brandSelector}>
                      {(['Visa', 'Mastercard', 'Maya', 'GCash'] as PaymentBrand[]).map(b => (
                        <TouchableOpacity 
                          key={b}
                          style={[st.brandOption, cardBrand === b && { borderColor: C.blue600, backgroundColor: '#f0f9ff' }]}
                          onPress={() => { setCardBrand(b); setErrors({}); }}
                        >
                          <Text style={[st.brandOptionText, { color: cardBrand === b ? C.blue600 : C.text2 }]}>{b}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {cardBrand === 'Visa' || cardBrand === 'Mastercard' ? (
                      // CARD FLOW
                      <>
                        <View style={st.inputSection}>
                          <Text style={[st.inputLabel, { color: C.text3 }]}>Card Number</Text>
                          <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }, errors.cardNumber && { borderColor: C.error, borderWidth: 1 }]}>
                            <Ionicons name="card-outline" size={20} color={errors.cardNumber ? C.error : C.text3} style={{ marginRight: 8 }} />
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
                          {errors.cardNumber && <Text style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.cardNumber}</Text>}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={[st.inputSection, { flex: 1 }]}>
                            <Text style={[st.inputLabel, { color: C.text3 }]}>Expiry (MM/YY)</Text>
                            <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }, errors.expiry && { borderColor: C.error, borderWidth: 1 }]}>
                              <TextInput
                                style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                                placeholder="12/28"
                                placeholderTextColor={C.text3}
                                value={formatExpiry(expiry)}
                                onChangeText={val => { setExpiry(val); setErrors(prev => ({ ...prev, expiry: '' })); }}
                                maxLength={5}
                              />
                            </View>
                            {errors.expiry && <Text style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.expiry}</Text>}
                          </View>
                          <View style={[st.inputSection, { flex: 1 }]}>
                            <Text style={[st.inputLabel, { color: C.text3 }]}>CVC</Text>
                            <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }, errors.cvc && { borderColor: C.error, borderWidth: 1 }]}>
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
                            {errors.cvc && <Text style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.cvc}</Text>}
                          </View>
                        </View>

                        <View style={st.inputSection}>
                          <Text style={[st.inputLabel, { color: C.text3 }]}>Cardholder Name</Text>
                          <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }, errors.cardholderName && { borderColor: C.error, borderWidth: 1 }]}>
                            <TextInput
                              style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                              placeholder="John Doe"
                              placeholderTextColor={C.text3}
                              value={cardholderName}
                              onChangeText={val => { setCardholderName(val); setErrors(prev => ({ ...prev, cardholderName: '' })); }}
                            />
                          </View>
                          {errors.cardholderName && <Text style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.cardholderName}</Text>}
                        </View>
                      </>
                    ) : (
                      // E-WALLET FLOW
                      <View style={st.inputSection}>
                        <Text style={[st.inputLabel, { color: C.text3 }]}>{cardBrand} Mobile Number</Text>
                        <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }, errors.phoneNumber && { borderColor: C.error, borderWidth: 1 }]}>
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
                        {errors.phoneNumber ? (
                          <Text style={{ color: C.error, fontSize: 11, marginTop: 4 }}>{errors.phoneNumber}</Text>
                        ) : (
                          <Text style={[st.helperText, { color: C.text3 }]}>
                            We'll send a 6-digit code to verify your account.
                          </Text>
                        )}
                      </View>
                    )}

                    <TouchableOpacity 
                      style={st.confirmBtn} 
                      onPress={handleAddPaymentMethod}
                      disabled={isProcessing}
                    >
                      <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                        {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.confirmBtnText}>{cardBrand === 'Visa' || cardBrand === 'Mastercard' ? 'Link Card' : 'Continue'}</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  // OTP FLOW
                  <View style={{ gap: 20 }}>
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <View style={[st.otpIconCircle, { backgroundColor: '#f0f9ff' }]}>
                        <Ionicons name="chatbubble-ellipses-outline" size={32} color={C.blue600} />
                      </View>
                      <Text style={[st.otpTitle, { color: C.text1 }]}>Verify your number</Text>
                      <Text style={[st.otpSub, { color: C.text3 }]}>
                        Enter the 6-digit code sent to +63 {phoneNumber}
                      </Text>
                    </View>

                    <View style={st.inputSection}>
                      <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9', justifyContent: 'center' }, errors.otp && { borderColor: C.error, borderWidth: 1 }]}>
                        <TextInput
                          style={[st.amountInput, { color: C.text1, fontSize: 24, letterSpacing: 12, textAlign: 'center' }]}
                          placeholder="000000"
                          placeholderTextColor={C.text3}
                          value={otp}
                          onChangeText={val => { setOtp(val); setErrors(prev => ({ ...prev, otp: '' })); }}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                      </View>
                      {errors.otp && <Text style={{ color: C.error, fontSize: 11, marginTop: 4, textAlign: 'center' }}>{errors.otp}</Text>}
                      <TouchableOpacity style={{ alignSelf: 'center', marginTop: 8 }}>
                        <Text style={{ color: C.blue600, fontWeight: '700', fontSize: 13 }}>Resend Code</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                      style={st.confirmBtn} 
                      onPress={handleVerifyOtp}
                      disabled={isProcessing}
                    >
                      <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                        {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.confirmBtnText}>Verify & Link</Text>}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={{ alignSelf: 'center' }} 
                      onPress={() => { setPaymentFlow('details'); setErrors({}); }}
                      disabled={isProcessing}
                    >
                      <Text style={{ color: C.text3, fontWeight: '600' }}>Change Number</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: SUCCESS */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={st.successOverlay}>
          <View style={[st.successModal, { backgroundColor: C.surface }]}>
            <View style={[st.successIconCircle, { backgroundColor: C.success }]}>
              <Ionicons name="checkmark" size={32} color="#fff" />
            </View>
            <Text style={[st.successTitle, { color: C.text1 }]}>Funds Added!</Text>
            <Text style={[st.successSubText, { color: C.text3 }]}>
              Your balance has been updated.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    height: 280,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  balanceCard: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: '#b8e6fe',
    marginTop: 2,
  },
  protectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  protectedText: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: '600',
  },
  balanceMain: {
    marginTop: 10,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b8e6fe',
  },
  balanceValue: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  escrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  escrowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fde68a',
  },
  addMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flex: 1,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  addMoneyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  methodList: {
    gap: 8,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  methodBrandIcon: {
    width: 40,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextShort: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 14,
    fontWeight: '700',
  },
  methodSub: {
    fontSize: 12,
  },
  defaultBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '700',
  },
  removeBtn: {
    padding: 8,
    marginLeft: 4,
  },
  addMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addMethodBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  txCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 12,
    marginTop: 2,
  },
  txAmountContainer: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  txStatus: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyTx: {
    padding: 40,
    alignItems: 'center',
  },
  escrowNote: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    gap: 10,
  },
  escrowNoteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalAvoid: {
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: 24,
    gap: 20,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  presetText: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputSection: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#94a3b8',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  selectedMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  methodBrandIconSmall: {
    width: 36,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextTiny: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  methodNameSmall: {
    fontSize: 13,
    fontWeight: '700',
  },
  methodSubSmall: {
    fontSize: 11,
  },
  defaultLabelSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0084d1',
  },
  noMethodLink: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0284c7',
    borderRadius: 16,
  },
  noMethodText: {
    color: '#0284c7',
    fontWeight: '700',
  },
  confirmBtn: {
    marginTop: 10,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  brandSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  brandOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  otpIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  otpSub: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModal: {
    width: width * 0.8,
    padding: 30,
    borderRadius: 32,
    alignItems: 'center',
    gap: 16,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  successSubText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
