import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { getPaymentMethods, addPaymentMethod, setDefaultPaymentMethod, removePaymentMethod } from '@/stores/paymentStore';
import { 
  isValidCardNumber, isValidExpiry, isValidCVC, isValidPHMobile, isValidCardholder,
  formatCardNumber, formatExpiry 
} from '@/lib/validation';
import type { PaymentMethod, PaymentBrand } from '@/types';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add Payment Form State
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
      const methods = await getPaymentMethods();
      setPaymentMethods(methods);
    } catch (e) {
      if (__DEV__) console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      if (!isValidPHMobile(phoneNumber)) {
        setErrors({ phoneNumber: 'Must be 10 digits starting with 9' });
        return;
      }
      setErrors({});
      setIsProcessing(true);
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

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, borderBottomWidth: 1, paddingTop: insets.top }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Payment Methods</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll}>
        <Text style={[st.sectionTitle, { color: C.text1 }]}>Stored Methods</Text>
        
        {loading ? (
          <ActivityIndicator color={C.blue600} style={{ marginTop: 20 }} />
        ) : paymentMethods.length === 0 ? (
          <View style={st.emptyState}>
            <Ionicons name="card-outline" size={48} color={C.text3} />
            <Text style={[st.emptyText, { color: C.text3 }]}>No payment methods added yet.</Text>
          </View>
        ) : (
          <View style={st.methodList}>
            {paymentMethods.map(method => (
              <View key={method.id} style={[st.methodCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => {
                    if (!method.isDefault) setDefaultPaymentMethod(method.id).then(fetchData);
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
                    Alert.alert('Remove Method', `Are you sure?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', onPress: () => removePaymentMethod(method.id).then(fetchData), style: 'destructive' }
                    ]);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={C.text3} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={[st.addMethodBtn, { borderColor: C.blue600 }]} 
          onPress={() => { resetPaymentForm(); setShowAddPayment(true); }}
        >
          <Ionicons name="add" size={20} color={C.blue600} />
          <Text style={[st.addMethodBtnText, { color: C.blue600 }]}>Add New Method</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL: ADD PAYMENT METHOD (REUSED LOGIC) */}
      <Modal visible={showAddPayment} animationType="slide" transparent>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => !isProcessing && setShowAddPayment(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalAvoid}>
            <View style={[st.modalSheet, { backgroundColor: C.surface }]} onStartShouldSetResponder={() => true}>
              <View style={st.modalHeader}>
                <Text style={[st.modalTitle, { color: C.text1 }]}>
                  {paymentFlow === 'otp' ? `Link ${cardBrand}` : 'Add Payment Method'}
                </Text>
                <TouchableOpacity onPress={() => setShowAddPayment(false)} disabled={isProcessing}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={18} color={C.text2} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={st.modalBody}>
                {paymentFlow === 'details' ? (
                  <>
                    <Text style={[st.fieldLabelSmall, { color: C.text3 }]}>Select Brand</Text>
                    <View style={st.brandSelector}>
                      {(['Visa', 'Mastercard', 'Maya', 'GCash'] as PaymentBrand[]).map(b => (
                        <TouchableOpacity
                          key={b}
                          style={[st.brandOption, cardBrand === b && { borderColor: C.blue600, backgroundColor: C.surface2 }]}
                          onPress={() => { setCardBrand(b); setErrors({}); }}
                        >
                          <Text style={[st.brandOptionText, { color: cardBrand === b ? C.blue600 : C.text2 }]}>{b}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {cardBrand === 'Visa' || cardBrand === 'Mastercard' ? (
                      <>
                        <View style={st.inputSection}>
                          <Text style={[st.fieldLabelSmall, { color: C.text3 }]}>Cardholder Name</Text>
                          <View style={[st.inputRow, { backgroundColor: C.surface2 }, errors.cardholderName && { borderColor: C.error }]}>
                            <TextInput
                              style={[st.input, { color: C.text1 }]}
                              placeholder="John Doe"
                              value={cardholderName}
                              onChangeText={val => { setCardholderName(val); setErrors(prev => ({ ...prev, cardholderName: '' })); }}
                              autoCapitalize="words"
                            />
                          </View>
                          {errors.cardholderName && <Text style={st.errorText}>{errors.cardholderName}</Text>}
                        </View>
                        <View style={st.inputSection}>
                          <Text style={[st.fieldLabelSmall, { color: C.text3 }]}>Card Number</Text>
                          <View style={[st.inputRow, { backgroundColor: C.surface2 }, errors.cardNumber && { borderColor: C.error }]}>
                            <Ionicons name="card-outline" size={18} color={errors.cardNumber ? C.error : C.text3} style={{ marginRight: 8 }} />
                            <TextInput
                              style={[st.input, { color: C.text1 }]}
                              placeholder="4242 4242 4242 4242"
                              value={formatCardNumber(cardNumber)}
                              onChangeText={val => { setCardNumber(val.replace(/\s+/g, '')); setErrors(prev => ({ ...prev, cardNumber: '' })); }}
                              keyboardType="number-pad"
                              maxLength={19}
                            />
                          </View>
                          {errors.cardNumber && <Text style={st.errorText}>{errors.cardNumber}</Text>}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                           <View style={{ flex: 1 }}>
                              <Text style={[st.fieldLabelSmall, { color: C.text3 }]}>Expiry (MM/YY)</Text>
                              <View style={[st.inputRow, { backgroundColor: C.surface2 }, errors.expiry && { borderColor: C.error }]}>
                                <TextInput
                                  style={[st.input, { color: C.text1 }]}
                                  placeholder="12/28"
                                  value={formatExpiry(expiry)}
                                  onChangeText={val => { setExpiry(val); setErrors(prev => ({ ...prev, expiry: '' })); }}
                                  maxLength={5}
                                />
                              </View>
                              {errors.expiry && <Text style={st.errorText}>{errors.expiry}</Text>}
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={[st.fieldLabelSmall, { color: C.text3 }]}>CVC</Text>
                              <View style={[st.inputRow, { backgroundColor: C.surface2 }, errors.cvc && { borderColor: C.error }]}>
                                <TextInput
                                  style={[st.input, { color: C.text1 }]}
                                  placeholder="123"
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
                      </>
                    ) : (
                      <View style={st.inputSection}>
                        <Text style={[st.fieldLabelSmall, { color: C.text3 }]}>{cardBrand} Number</Text>
                        <View style={[st.inputRow, { backgroundColor: C.surface2 }, errors.phoneNumber && { borderColor: C.error }]}>
                          <Text style={{ fontWeight: '700', color: C.text1, marginRight: 8 }}>+63</Text>
                          <TextInput
                            style={[st.input, { color: C.text1 }]}
                            placeholder="917 123 4567"
                            value={phoneNumber}
                            onChangeText={val => { setPhoneNumber(val.replace(/\s+/g, '')); setErrors(prev => ({ ...prev, phoneNumber: '' })); }}
                            keyboardType="phone-pad"
                            maxLength={10}
                          />
                        </View>
                      </View>
                    )}

                    <TouchableOpacity style={st.confirmBtn} onPress={handleAddPaymentMethod} disabled={isProcessing}>
                      <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                        {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.confirmBtnText}>{cardBrand === 'Visa' || cardBrand === 'Mastercard' ? 'Link Card' : 'Continue'}</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ gap: 20 }}>
                    <Text style={{ textAlign: 'center', color: C.text3 }}>Enter 6-digit code sent to +63 {phoneNumber}</Text>
                    <View style={[st.inputRow, { backgroundColor: C.surface2, justifyContent: 'center' }, errors.otp && { borderColor: C.error }]}>
                      <TextInput
                        style={[st.input, { color: C.text1, textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
                        placeholder="000000"
                        value={otp}
                        onChangeText={val => { setOtp(val); setErrors(prev => ({ ...prev, otp: '' })); }}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <TouchableOpacity style={st.confirmBtn} onPress={handleVerifyOtp} disabled={isProcessing}>
                      <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                        {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.confirmBtnText}>Verify & Link</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  methodList: { gap: 12 },
  methodCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1.5, gap: 12 },
  methodBrandIcon: { width: 40, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandTextShort: { color: '#fff', fontSize: 12, fontWeight: '900' },
  methodInfo: { flex: 1 },
  methodName: { fontSize: 14, fontWeight: '700' },
  methodSub: { fontSize: 12 },
  defaultBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  defaultBadgeText: { fontSize: 11, color: '#0284c7', fontWeight: '700' },
  removeBtn: { padding: 8 },
  addMethodBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', marginTop: 24 },
  addMethodBtnText: { fontSize: 15, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalAvoid: { justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalBody: { paddingHorizontal: 24, gap: 20 },
  brandSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  brandOptionText: { fontSize: 13, fontWeight: '600' },
  inputSection: { gap: 6 },
  fieldLabelSmall: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: 'transparent' },
  input: { flex: 1, fontSize: 15, fontWeight: '600' },
  confirmBtn: { height: 56, borderRadius: 16, overflow: 'hidden', marginTop: 10 },
  btnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 2 },
});
