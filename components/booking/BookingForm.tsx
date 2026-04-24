import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Dimensions,
  ScrollView, Modal, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { createJob } from '@/actions/jobs';
import { getBalance, addMoney } from '@/actions/payments';
import { getPaymentMethods, addPaymentMethod } from '@/stores/paymentStore';
import { 
  isValidCardNumber, isValidExpiry, isValidCVC, isValidPHMobile, isValidCardholder,
  formatCardNumber, formatExpiry, isStrictAddress, isValidDistance 
} from '@/lib/validation';
import { CLEAN_TYPES, TASKS, URGENCIES, computePrice } from '@/stores/bookingStore';
import type { JobUrgency, PaymentMethod, PaymentBrand } from '@/types';
import { KeyboardView } from '@/components/shared/KeyboardView';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

type Step = 'type' | 'tasks' | 'instructions' | 'location' | 'urgency' | 'review' | 'success';

const { width } = Dimensions.get('window');
const STEPS_ORDER: Step[] = ['type', 'tasks', 'instructions', 'location', 'urgency', 'review'];

// Mock City Hall coordinates (Manila)
const CITY_HALL = { lat: 14.5896, lng: 120.9813 };

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function BookingForm() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const { refreshProfile, profile } = useAuth();
  
  // -- State --
  const [step, setStep] = useState<Step>('type');
  const [cleanType, setCleanType] = useState<string>('regular');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<JobUrgency>('LOW');
  const [address, setAddress] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPickingMedia, setIsPickingMedia] = useState(false);

  // -- Payment State --
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('0');

  // Add Payment Method Form
  const [cardBrand, setCardBrand] = useState<PaymentBrand>('Visa');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [paymentFlow, setPaymentFlow] = useState<'details' | 'otp'>('details');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset tasks when cleaning type changes
  useEffect(() => {
    if (cleanType === 'move_out') {
      setSelectedTasks(['fridge', 'oven', 'windows']);
    } else if (cleanType === 'deep') {
      setSelectedTasks(['vacuum', 'mop', 'bath', 'kitchen', 'fridge', 'oven', 'windows', 'trash', 'dust']);
    } else {
      setSelectedTasks([]);
    }
  }, [cleanType]);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  async function loadPaymentMethods() {
    const methods = await getPaymentMethods();
    setPaymentMethods(methods);
    if (methods.length > 0) {
      const def = methods.find(m => m.isDefault) || methods[0];
      setSelectedMethodId(def.id);
    }
  }

  async function handlePickMedia() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow photo library access to attach images.');
      return;
    }
    setIsPickingMedia(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        allowsMultipleSelection: true,
        mediaTypes: ImagePicker.MediaTypeOptions.All,
      });
      if (!res.canceled) {
        setMediaUris(prev => [...prev, ...res.assets.map(a => a.uri)]);
      }
    } finally {
      setIsPickingMedia(false);
    }
  }

  // -- Handlers --
  async function handleUseCurrentLocation() {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enter your address manually.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const rev = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });

      if (rev.length > 0) {
        const a = rev[0];
        const formatted = `${a.name || ''} ${a.street || ''}, ${a.district || a.city || ''}`.trim();
        setAddress(formatted);
      }

      const dist = calculateDistance(loc.coords.latitude, loc.coords.longitude, CITY_HALL.lat, CITY_HALL.lng);
      setDistance(dist.toFixed(1));

      Alert.alert('Location Found', 'Your address and distance have been updated.');
    } catch (e) {
      Alert.alert('Error', 'Could not fetch location. Please type it manually.');
    } finally {
      setIsLocating(false);
    }
  }

  const price = computePrice(cleanType, urgency, selectedTasks.length);
  const currentStepIdx = STEPS_ORDER.indexOf(step) + 1;
  const priceInDollars = price;
  const balance = profile?.money_balance ?? 0;
  const hasFunds = balance >= priceInDollars;

  function toggleTask(taskId: string) {
    if (cleanType === 'move_out' && ['fridge', 'oven', 'windows'].includes(taskId)) {
      return; 
    }
    setSelectedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  }

  function goNext() {
    if (step === 'type') {
      if (cleanType === 'deep') {
        setStep('instructions');
        return;
      }
      if (cleanType === 'move_out') {
        setSelectedTasks(['fridge', 'oven', 'windows']);
      }
    }

    if (step === 'tasks') {
      if (cleanType === 'regular' && selectedTasks.length < 2) {
        Alert.alert('Selection Required', 'Standard Refresh requires at least 2 tasks.');
        return;
      }
      if (selectedTasks.length === 0) {
        Alert.alert('Selection Required', 'Please select at least one task.');
        return;
      }
    }

    if (step === 'location') {
      if (!isStrictAddress(address)) {
        Alert.alert('Invalid Address', 'Please enter a complete address (e.g. 123 Main St, Brgy Central).');
        return;
      }
      if (!isValidDistance(distance)) {
        Alert.alert('Distance Required', 'Distance must be between 0.5km and 60km from City Hall.');
        return;
      }
    }

    const nextIdx = STEPS_ORDER.indexOf(step) + 1;
    if (nextIdx < STEPS_ORDER.length) setStep(STEPS_ORDER[nextIdx]);
  }

  function goBack() {
    if (step === 'type') {
      router.back();
      return;
    }
    if (step === 'instructions' && cleanType === 'deep') {
      setStep('type');
      return;
    }
    const prevIdx = STEPS_ORDER.indexOf(step) - 1;
    if (prevIdx >= 0) setStep(STEPS_ORDER[prevIdx]);
  }

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
        const methods = await getPaymentMethods();
        setPaymentMethods(methods);
        setShowAddPayment(false);
        resetPaymentForm();
        setShowAddMoney(true);
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
      const methods = await getPaymentMethods();
      setPaymentMethods(methods);
      setShowAddPayment(false);
      resetPaymentForm();
      setShowAddMoney(true);
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
    const defaultMethod = paymentMethods.find(m => m.isDefault);
    if (!defaultMethod) {
      setShowAddMoney(false);
      setShowAddPayment(true);
      return;
    }

    setIsProcessing(true);
    try {
      await addMoney(amount);
      await refreshProfile();
      setShowAddMoney(false);
      Alert.alert('Success', `$${amount.toFixed(2)} added to your wallet.`);
    } catch (e: any) {
      Alert.alert('Transaction Failed', e.message || 'Could not complete top-up');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePostJob() {
    const parsedDist = parseFloat(distance);
    if (isNaN(parsedDist) || parsedDist <= 0) {
      Alert.alert('Invalid distance', 'Please enter a valid distance from City Hall.');
      return;
    }

    setLoading(true);
    try {
      const currentBalance = await getBalance();
      if (currentBalance < priceInDollars) {
        setLoading(false);
        setDepositAmount((priceInDollars - currentBalance).toFixed(2));
        if (paymentMethods.length === 0) {
          setShowAddPayment(true);
        } else {
          setShowAddMoney(true);
        }
        return;
      }

      await createJob({
        tasks: selectedTasks.map(id => TASKS.find(t => t.id === id)?.label || id),
        urgency,
        address: address.trim(),
        distance: parsedDist,
        price,
        size: CLEAN_TYPES.find(t => t.id === cleanType)?.label || 'Regular',
        customInstructions: notes.trim(),
      });

      await refreshProfile();
      setStep('success');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <View style={[st.container, { backgroundColor: C.bg }]}>
        <ScrollView contentContainerStyle={st.successScroll} showsVerticalScrollIndicator={false}>
          <View style={st.successContent}>
            <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.successIconContainer}>
              <Ionicons name="checkmark" size={44} color="#fff" />
            </LinearGradient>
            
            <Text style={[st.successTitle, { color: C.text1 }]}>Job Posted!</Text>
            <Text style={[st.successSub, { color: C.text3 }]}>
              Cleaners nearby are being notified. Expect a claim within minutes.
            </Text>

            <View style={[st.successCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <View style={st.successCardHeader}>
                <Text style={[st.successCardTitle, { color: C.text1 }]}>
                  {CLEAN_TYPES.find(t => t.id === cleanType)?.label}
                </Text>
                <View style={[st.priorityBadge, { backgroundColor: isDark ? '#064e3b' : '#dcfce7' }]}>
                  <Text style={[st.priorityBadgeText, { color: isDark ? '#34d399' : '#15803d' }]}>{urgency} Priority</Text>
                </View>
              </View>
              <Text style={[st.successCardAddress, { color: C.text3 }]}>{address || 'No address provided'}</Text>
              <Text style={[st.successCardPrice, { color: C.blue600 }]}>${price.toFixed(2)}</Text>
              <Text style={[st.successCardNote, { color: C.text3 }]}>Held in escrow until approved</Text>
            </View>

            <View style={st.successActions}>
              <TouchableOpacity style={[st.primaryBtn, { shadowColor: C.blue600 }]} onPress={() => router.replace('/customer/(tabs)/jobs' as any)}>
                <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                  <Text style={st.primaryBtnText}>View My Jobs</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={[st.secondaryBtn, { backgroundColor: C.surface, borderColor: C.divider }]} onPress={() => router.replace('/customer/(tabs)' as any)}>
                <Text style={[st.secondaryBtnText, { color: C.text2 }]}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <LinearGradient colors={['#0c4a6e', '#0284c7']} style={st.header}>
        <View style={st.headerTop}>
          <TouchableOpacity style={st.backIcon} onPress={goBack}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={st.headerText}>
            <Text style={st.headerTitle}>Book a Clean</Text>
            <Text style={st.headerSubText}>
              {step.charAt(0).toUpperCase() + step.slice(1)} — Step {currentStepIdx} of 6
            </Text>
          </View>
          {step !== 'type' && (
            <View style={st.priceBadge}>
              <Text style={st.priceBadgeText}>${price.toFixed(0)}</Text>
            </View>
          )}
        </View>
        <View style={st.progressRow}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} style={[st.progressSegment, { backgroundColor: i <= currentStepIdx ? '#fff' : 'rgba(255,255,255,0.25)' }]} />
          ))}
        </View>
      </LinearGradient>

      <KeyboardView contentContainerStyle={st.scroll}>
        {step === 'type' && (
          <View style={st.stepContainer}>
            <Text style={[st.stepTitle, { color: C.text1 }]}>What type of clean?</Text>
            <Text style={[st.stepSub, { color: C.text3 }]}>Choose the service you need</Text>
            <View style={st.grid}>
              {CLEAN_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[st.gridItem, { backgroundColor: C.surface, borderColor: cleanType === type.id ? C.blue600 : C.divider }]}
                  onPress={() => setCleanType(type.id)}
                >
                  <Text style={st.gridEmoji}>{type.icon}</Text>
                  <Text style={[st.gridLabel, { color: C.text1 }]}>{type.label}</Text>
                  <Text style={[st.gridSub, { color: C.text3 }]}>{type.sub}</Text>
                  <Text style={[st.gridPrice, { color: C.blue600 }]}>from ${type.price.toFixed(0)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 'tasks' && (
          <View style={st.stepContainer}>
            <Text style={[st.stepTitle, { color: C.text1 }]}>Add specific tasks</Text>
            <Text style={[st.stepSub, { color: C.text3 }]}>Each extra task adds $5</Text>
            <View style={st.taskList}>
              {TASKS.map(task => {
                const isSelected = selectedTasks.includes(task.id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[st.taskItem, { backgroundColor: isSelected ? (isDark ? '#0c4a6e30' : '#e0f2fe') : C.surface, borderColor: isSelected ? C.blue600 : C.divider }]}
                    onPress={() => toggleTask(task.id)}
                  >
                    <View style={[st.checkbox, isSelected && { backgroundColor: C.blue600, borderColor: C.blue600 }]}>
                      {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={[st.taskLabel, { color: C.text1 }]}>{task.icon} {task.label}</Text>
                    {isSelected && <Text style={[st.taskFee, { color: C.blue600 }]}>+$5</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 'instructions' && (
          <View style={st.stepContainer}>
            <Text style={[st.stepTitle, { color: C.text1 }]}>Instructions & Photos</Text>
            <Text style={[st.stepSub, { color: C.text3 }]}>Help the cleaner understand your needs</Text>
            <Text style={[st.sectionLabel, { color: C.text3 }]}>SPECIAL INSTRUCTIONS (OPTIONAL)</Text>
            <TextInput
              style={[st.textArea, { backgroundColor: C.surface, borderColor: C.divider, color: C.text1, height: 120 }]}
              placeholder="e.g. Key is under the mat..."
              placeholderTextColor={C.text3}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <Text style={[st.sectionLabel, { color: C.text3, marginTop: 24 }]}>UPLOAD PHOTOS OR VIDEOS (OPTIONAL)</Text>
            <View style={st.mediaRow}>
              {mediaUris.map((uri, idx) => (
                <View key={idx} style={[st.mediaPreview, { backgroundColor: C.surface2 }]}>
                  <Image source={{ uri }} style={st.mediaImage} resizeMode="cover" />
                  <TouchableOpacity style={st.removeMedia} onPress={() => setMediaUris(prev => prev.filter((_, i) => i !== idx))}>
                    <Ionicons name="close-circle" size={16} color={C.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[st.addMediaBtn, { backgroundColor: C.surface, borderColor: C.divider }]}
                onPress={handlePickMedia}
                disabled={isPickingMedia}
              >
                <Ionicons name="camera-outline" size={24} color={C.text3} />
                <Text style={{ color: C.text3, fontSize: 10, marginTop: 4 }}>
                  {isPickingMedia ? '...' : 'Add Media'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'location' && (
          <View style={st.stepContainer}>
            <Text style={[st.stepTitle, { color: C.text1 }]}>Where is it?</Text>
            <Text style={[st.stepSub, { color: C.text3 }]}>Enter the property address</Text>
            
            <Text style={[st.inputLabel, { color: C.text3, marginBottom: 8 }]}>SERVICE ADDRESS</Text>
            <View style={[st.inputRow, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Ionicons name="location" size={18} color={C.blue600} style={st.inputIcon} />
              <TextInput style={[st.textInput, { color: C.text1 }]} placeholder="Street name, Brgy, City..." placeholderTextColor={C.text3} value={address} onChangeText={setAddress} />
            </View>

            <Text style={[st.inputLabel, { color: C.text3, marginBottom: 8 }]}>DISTANCE FROM CITY HALL (KM)</Text>
            <View style={[st.inputRow, { backgroundColor: C.surface, borderColor: C.divider, marginBottom: 8 }]}>
              <Ionicons name="navigate" size={18} color={C.blue600} style={st.inputIcon} />
              <TextInput style={[st.textInput, { color: C.text1 }]} placeholder="e.g. 5.5" placeholderTextColor={C.text3} value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />
            </View>
            <Text style={{ fontSize: 11, color: C.text3, marginBottom: 24, fontStyle: 'italic' }}>
              * Calculated from City Hall to ensure you are within our service range.
            </Text>

            <View style={[st.mapPlaceholder, { borderColor: C.divider }]}>
              <LinearGradient colors={isDark ? ['#050811', '#0a1120'] : ['#0a0f1e', '#0f1c2e']} style={st.mapBg}>
                <View style={st.mapOverlay}>
                  {isLocating ? <ActivityIndicator color="#fff" size="large" /> : (
                    <>
                      <View style={[st.mapPinContainer, { backgroundColor: 'rgba(2, 132, 199, 0.4)', borderColor: '#0284c7' }]}>
                        <Ionicons name="location" size={20} color="#fff" />
                      </View>
                      <TouchableOpacity style={st.gpsActionBtn} onPress={handleUseCurrentLocation} activeOpacity={0.7}>
                        <Ionicons name="locate" size={14} color="#fff" /><Text style={st.mapLabel}>Use Current Location</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </LinearGradient>
            </View>
          </View>
        )}

        {step === 'urgency' && (
          <View style={st.stepContainer}>
            <Text style={[st.stepTitle, { color: C.text1 }]}>How urgent?</Text>
            <Text style={[st.stepSub, { color: C.text3 }]}>Higher urgency costs more but gets faster service</Text>
            <View style={st.urgencyList}>
              {URGENCIES.map(u => {
                const isSelected = urgency === u.value;
                const uBg = isSelected ? (isDark ? u.color + '25' : u.color + '15') : C.surface;
                return (
                  <TouchableOpacity key={u.value} style={[st.urgencyItem, { borderColor: isSelected ? u.color : C.divider, backgroundColor: uBg }]} onPress={() => setUrgency(u.value)}>
                    <View style={st.urgencyLeft}><View style={[st.urgencyDot, { backgroundColor: u.color }]} /><View><Text style={[st.urgencyLabel, { color: C.text1 }]}>{u.label}</Text><Text style={[st.urgencyDesc, { color: C.text3 }]}>{u.desc}</Text></View></View>
                    {u.fee > 0 ? <Text style={[st.urgencyFee, { color: u.color }]}>+${u.fee.toFixed(0)}</Text> : isSelected && <Ionicons name="checkmark-circle" size={24} color={u.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 'review' && (
          <View style={st.stepContainer}>
            <Text style={[st.stepTitle, { color: C.text1 }]}>Review & Post</Text>
            <Text style={[st.stepSub, { color: C.text3 }]}>Confirm everything before posting</Text>
            <View style={[st.reviewCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <View style={st.reviewHeader}><View><Text style={[st.reviewType, { color: C.text1 }]}>{CLEAN_TYPES.find(t => t.id === cleanType)?.label}</Text><Text style={[st.reviewAddress, { color: C.text3 }]}>{address || 'No address provided'}</Text></View><View style={[st.reviewPriority, { backgroundColor: isDark ? C.blue800 : '#e0f2fe' }]}><Text style={[st.reviewPriorityText, { color: C.blue400 }]}>{urgency}</Text></View></View>
              <View style={[st.priceBreakdown, { borderTopColor: C.divider }]}>
                <View style={st.priceRow}><Text style={[st.priceLabel, { color: C.text3 }]}>Base price</Text><Text style={[st.priceValue, { color: C.text1 }]}>${(CLEAN_TYPES.find(t => t.id === cleanType)?.price || 0).toFixed(0)}</Text></View>
                {selectedTasks.length > 0 && <View style={st.priceRow}><Text style={[st.priceLabel, { color: C.text3 }]}>{selectedTasks.length} extra tasks</Text><Text style={[st.priceValue, { color: C.text1 }]}>+${(selectedTasks.length * 5).toFixed(0)}</Text></View>}
                <View style={[st.totalRow, { borderTopColor: C.divider }]}><Text style={[st.totalLabel, { color: C.text1 }]}>Total</Text><Text style={[st.totalValue, { color: C.blue600 }]}>${price.toFixed(0)}</Text></View>
                <View style={st.priceRow}><Text style={[st.priceLabel, { color: C.text3 }]}>Current Balance</Text><Text style={[st.priceValue, { color: hasFunds ? C.success : C.error }]}>${balance.toFixed(2)}</Text></View>
              </View>
            </View>
            <View style={[st.escrowNotice, { backgroundColor: isDark ? '#451a0330' : '#fffbeb', borderColor: isDark ? '#451a03' : '#fde68a' }]}><Ionicons name="flash" size={16} color={isDark ? '#fbbf24' : '#973c00'} /><Text style={[st.escrowText, { color: isDark ? '#fbbf24' : '#973c00' }]}><Text style={st.escrowBold}>Secure Escrow:</Text> ${price.toFixed(0)} held safely.</Text></View>
            {!hasFunds && (
              <View style={[st.warningBox, { backgroundColor: isDark ? '#450a0a30' : '#fef2f2', borderColor: isDark ? '#450a0a' : '#fee2e2' }]}>
                <View style={st.warningHeader}><Ionicons name="alert-circle" size={18} color={C.error} /><Text style={[st.warningTitle, { color: C.error }]}>Insufficient Balance</Text></View>
                <Text style={[st.warningText, { color: isDark ? '#f87171' : '#991b1b' }]}>Need an additional ${(priceInDollars - balance).toFixed(2)}.</Text>
                <TouchableOpacity style={[st.addFundsBtn, { backgroundColor: C.error }]} onPress={() => { setDepositAmount((priceInDollars - balance).toFixed(2)); if (paymentMethods.length === 0) setShowAddPayment(true); else setShowAddMoney(true); }}><Text style={st.addFundsBtnText}>Add Funds</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </KeyboardView>

      {['type', 'tasks', 'instructions', 'location', 'urgency', 'review'].includes(step) && (
        <View style={[st.footer, { backgroundColor: C.bg }]}>
          <TouchableOpacity style={[st.continueBtn, { shadowColor: C.blue600 }, (step === 'location' && (!isStrictAddress(address) || !isValidDistance(distance))) && st.disabled]} onPress={step === 'review' ? handlePostJob : goNext} disabled={loading || (step === 'location' && (!isStrictAddress(address) || !isValidDistance(distance)))}>
            <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Text style={st.continueBtnText}>{step === 'review' ? `Post Job — $${price.toFixed(0)}` : 'Continue'}</Text>{step !== 'review' && <Ionicons name="arrow-forward" size={18} color="#fff" />}</>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* MODALS */}
      <Modal visible={showAddMoney} animationType="slide" transparent>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => !isProcessing && setShowAddMoney(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalAvoid}>
            <View style={[st.modalSheet, { backgroundColor: C.surface }]}>
              <View style={st.modalHeader}>
                <Text style={[st.modalTitle, { color: C.text1 }]}>Add Funds</Text>
                <TouchableOpacity onPress={() => setShowAddMoney(false)} disabled={isProcessing}>
                  <Ionicons name="close" size={24} color={C.text2} />
                </TouchableOpacity>
              </View>
              
              <View style={st.modalBody}>
                <Text style={[st.inputLabel, { color: C.text3 }]}>Select Payment Method</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 100, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {paymentMethods.map(m => (
                      <TouchableOpacity 
                        key={m.id} 
                        style={[
                          st.methodMiniCard, 
                          { backgroundColor: C.surface2, borderColor: selectedMethodId === m.id ? C.blue600 : C.divider },
                          selectedMethodId === m.id && { borderWidth: 2 }
                        ]}
                        onPress={() => setSelectedMethodId(m.id)}
                      >
                        <Ionicons name={m.type === 'card' ? 'card-outline' : 'wallet-outline'} size={18} color={C.text1} />
                        <Text style={[st.methodMiniText, { color: C.text1 }]}>
                          {m.brand} {m.last4 ? `****${m.last4}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity 
                      style={[st.methodMiniCard, { borderStyle: 'dashed', borderColor: C.divider }]}
                      onPress={() => { setShowAddMoney(false); setShowAddPayment(true); }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={C.blue600} />
                      <Text style={[st.methodMiniText, { color: C.blue600 }]}>Add New</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <Text style={[st.inputLabel, { color: C.text3 }]}>Amount to Deposit</Text>
                <View style={[st.amountInputContainer, { backgroundColor: C.surface2 }]}>
                  <Text style={st.currencySymbol}>$</Text>
                  <TextInput 
                    style={[st.amountInput, { color: C.text1 }]} 
                    keyboardType="decimal-pad" 
                    value={depositAmount} 
                    onChangeText={setDepositAmount} 
                  />
                </View>

                <TouchableOpacity 
                  style={[st.confirmBtn, (!selectedMethodId || isProcessing) && { opacity: 0.5 }]} 
                  onPress={handleAddMoney} 
                  disabled={isProcessing || !selectedMethodId}
                >
                  <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                    {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={st.confirmBtnText}>Confirm & Add Funds</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAddPayment} animationType="slide" transparent>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => !isProcessing && setShowAddPayment(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalAvoid}>
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
                      <>
                        <View style={st.inputSection}>
                          <Text style={[st.inputLabel, { color: C.text3 }]}>Card Number</Text>
                          <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9' }, errors.cardNumber && { borderColor: C.error, borderWidth: 1 }]}>
                            <Ionicons name="card-outline" size={20} color={errors.cardNumber ? C.error : C.text3} style={{ marginRight: 8 }} />
                            <TextInput
                              style={[st.amountInput, { color: C.text1, fontSize: 16 }]}
                              placeholder="4242 4242 4242 4242"
                              placeholderTextColor={C.text3}
                              value={cardNumber}
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
                                value={expiry}
                                onChangeText={val => { setExpiry(val); setErrors(prev => ({ ...prev, expiry: '' })); }}
                                maxLength={5}
                              />
                            </View>
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
                        </View>
                      </>
                    ) : (
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
                        <Text style={[st.helperText, { color: C.text3 }]}>We'll send a 6-digit code to verify your account.</Text>
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
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <View style={[st.otpIconCircle, { backgroundColor: '#f0f9ff' }]}>
                        <Ionicons name="chatbubble-ellipses-outline" size={32} color={C.blue600} />
                      </View>
                      <Text style={[st.otpTitle, { color: C.text1 }]}>Verify your number</Text>
                      <Text style={[st.otpSub, { color: C.text3 }]}>Enter the 6-digit code sent to +63 {phoneNumber}</Text>
                    </View>
                    <View style={[st.amountInputContainer, { backgroundColor: '#f1f5f9', justifyContent: 'center' }]}>
                      <TextInput
                        style={[st.amountInput, { color: C.text1, fontSize: 24, letterSpacing: 12, textAlign: 'center' }]}
                        placeholder="000000"
                        placeholderTextColor={C.text3}
                        value={otp}
                        onChangeText={setOtp}
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
  header: { paddingTop: 48, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backIcon: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSubText: { fontSize: 12, color: '#b8e6fe' },
  priceBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  priceBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  scroll: { padding: 16, paddingBottom: 100 },
  stepContainer: { flex: 1 },
  stepTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  stepSub: { fontSize: 14, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: (width - 44) / 2, padding: 16, borderRadius: 24, borderWidth: 2 },
  gridEmoji: { fontSize: 22, marginBottom: 12 },
  gridLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  gridSub: { fontSize: 11, marginBottom: 8, height: 32 },
  gridPrice: { fontSize: 14, fontWeight: '700' },
  taskList: { gap: 8 },
  taskItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  taskLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  taskFee: { fontSize: 12, fontWeight: '600' },
  urgencyList: { gap: 12 },
  urgencyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 24, borderWidth: 2 },
  urgencyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  urgencyDot: { width: 16, height: 16, borderRadius: 8 },
  urgencyLabel: { fontSize: 16, fontWeight: '700' },
  urgencyDesc: { fontSize: 12 },
  urgencyFee: { fontSize: 14, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 14 },
  mapPlaceholder: { height: 160, borderRadius: 24, overflow: 'hidden', marginBottom: 24, borderWidth: 1 },
  mapBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapOverlay: { alignItems: 'center' },
  mapPinContainer: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  mapLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  gpsActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(2, 132, 199, 0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  gpsDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  gpsText: { fontSize: 9 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8 },
  textArea: { height: 80, borderRadius: 16, borderWidth: 1, padding: 12, textAlignVertical: 'top', fontSize: 14 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  mediaPreview: { width: 64, height: 64, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  mediaImage: { width: 64, height: 64, borderRadius: 12 },
  removeMedia: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 8 },
  addMediaBtn: { width: 64, height: 64, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  reviewCard: { padding: 18, borderRadius: 24, borderWidth: 1, marginBottom: 16 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  reviewType: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  reviewAddress: { fontSize: 12 },
  reviewPriority: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  reviewPriorityText: { fontSize: 12, fontWeight: '700' },
  priceBreakdown: { borderTopWidth: 1, paddingTop: 14, gap: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 14, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 22, fontWeight: '800' },
  balanceRow: { alignItems: 'flex-end', marginTop: 4 },
  balanceLabel: { fontSize: 12 },
  escrowNotice: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  escrowText: { flex: 1, fontSize: 12, lineHeight: 18 },
  escrowBold: { fontWeight: '700' },
  warningBox: { padding: 16, borderRadius: 20, borderWidth: 1, marginTop: 16, gap: 8 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningTitle: { fontSize: 15, fontWeight: '700' },
  warningText: { fontSize: 13, lineHeight: 18 },
  addFundsBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  addFundsBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalAvoid: { justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingHorizontal: 24, gap: 20 },
  inputLabel: { fontSize: 12, fontWeight: '600' },
  amountInputContainer: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, paddingHorizontal: 16 },
  currencySymbol: { fontSize: 20, fontWeight: '700', color: '#94a3b8', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 18, fontWeight: '700' },
  confirmBtn: { marginTop: 10, height: 56, borderRadius: 16, overflow: 'hidden' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  methodMiniCard: {
    width: 120,
    height: 70,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  methodMiniText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  brandSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  brandOptionText: { fontSize: 13, fontWeight: '600' },
  otpTitle: { fontSize: 18, fontWeight: '800' },
  otpSub: { fontSize: 13, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24 },
  continueBtn: { height: 56, borderRadius: 16, overflow: 'hidden' },
  btnGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  successScroll: { flexGrow: 1, justifyContent: 'center' },
  successContent: { alignItems: 'center', padding: 24 },
  successIconContainer: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  successTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successSub: { fontSize: 14, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  successCard: { width: '100%', padding: 20, borderRadius: 24, borderWidth: 1, alignItems: 'center', marginBottom: 32 },
  successCardHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 8 },
  successCardTitle: { fontSize: 16, fontWeight: '700' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  priorityBadgeText: { fontSize: 12, fontWeight: '700' },
  successCardAddress: { fontSize: 12, marginBottom: 12 },
  successCardPrice: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  successCardNote: { fontSize: 12 },
  successActions: { width: '100%', gap: 12 },
  primaryBtn: { height: 54, borderRadius: 16, overflow: 'hidden' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { height: 54, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
});
