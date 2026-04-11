// Mobile equivalent of components/booking/BookingForm.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { createJob } from '@/app/actions/jobs';
import { getBalance } from '@/app/actions/payments';
import { SIZES, TASKS, URGENCIES, computePrice } from '@/stores/bookingStore';
import type { JobUrgency } from '@/types';

type Step = 'size' | 'location' | 'urgency' | 'payment';

const STEPS: { id: Step; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'size',     label: 'Size',     icon: 'resize-outline' },
  { id: 'location', label: 'Location', icon: 'location-outline' },
  { id: 'urgency',  label: 'Urgency',  icon: 'flash-outline' },
  { id: 'payment',  label: 'Confirm',  icon: 'checkmark-circle-outline' },
];

const { width } = Dimensions.get('window');

// ── Step indicator ────────────────────────────────────────────────────────────
function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <View style={st.stepper}>
      {STEPS.map((step, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={step.id}>
            <View style={st.stepItem}>
              <View style={[st.stepDot, active && st.stepDotActive, done && st.stepDotDone]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Ionicons name={step.icon} size={12} color={active ? '#fff' : Colors.text3} />}
              </View>
              <Text style={[st.stepLabel, (active || done) && st.stepLabelActive]}>
                {step.label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[st.stepLine, done && st.stepLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Booking summary sidebar (shown on payment step) ───────────────────────────
function BookingSummary({
  size, address, urgency, tasks, price,
}: {
  size: string; address: string; urgency: JobUrgency; tasks: string[]; price: number;
}) {
  return (
    <View style={st.summary}>
      <Text style={st.summaryTitle}>Booking Summary</Text>
      {[
        { label: 'Size',     value: size },
        { label: 'Location', value: address },
        { label: 'Urgency',  value: urgency },
        { label: 'Tasks',    value: tasks.join(', ') },
      ].map((row) => (
        <View key={row.label} style={st.summaryRow}>
          <Text style={st.summaryKey}>{row.label}</Text>
          <Text style={st.summaryVal} numberOfLines={2}>{row.value}</Text>
        </View>
      ))}
      <View style={st.summaryTotal}>
        <Text style={st.summaryTotalLabel}>Estimated Total</Text>
        <Text style={st.summaryTotalValue}>${(price / 100).toFixed(2)}</Text>
        <Text style={st.summaryTotalNote}>Held in escrow until completion</Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BookingForm() {
  const router = useRouter();
  const [step,     setStep]     = useState<Step>('size');
  const [size,     setSize]     = useState('');
  const [address,  setAddress]  = useState('');
  const [distance, setDistance] = useState('');
  const [urgency,  setUrgency]  = useState<JobUrgency>('NORMAL');
  const [tasks,    setTasks]    = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const price   = size ? computePrice(size, urgency, tasks) : 0;

  function toggleTask(t: string) {
    setTasks((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function canNext(): boolean {
    if (step === 'size')     return !!size;
    if (step === 'location') return address.trim().length > 5 && distance.trim().length > 0;
    if (step === 'urgency')  return tasks.length > 0;
    return true;
  }

  function goNext() {
    const order: Step[] = ['size', 'location', 'urgency', 'payment'];
    const next = order[stepIdx + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const order: Step[] = ['size', 'location', 'urgency', 'payment'];
    const prev = order[stepIdx - 1];
    if (prev) setStep(prev);
  }

  async function handleSubmit() {
  if (tasks.length === 0) {
    Alert.alert('Missing info', 'Please select at least one task.');
    return;
  }
  if (!address.trim() || address.trim().length < 5) {
    Alert.alert('Missing info', 'Please enter a valid address.');
    return;
  }
  const parsedDist = parseFloat(distance);
  if (isNaN(parsedDist) || parsedDist <= 0) {
    Alert.alert('Invalid distance', 'Please enter a valid distance in KM.');
    return;
  }
  setLoading(true);
  try {
    // Check balance before booking
    const balance = await getBalance();
    const priceInDollars = price / 100;
    if (balance < priceInDollars) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet has $${balance.toFixed(2)} but this job costs $${priceInDollars.toFixed(2)}. Please deposit funds first.`,
      );
      setLoading(false);
      return;
    }

    await createJob({
      tasks,          // string[]
      urgency,
      address: address.trim(),
      distance: parsedDist,
      price,
    });
    Alert.alert(
      'Order Placed! 🎉',
      'Your cleaning request is now open. An employee will claim it shortly.',
      [{ text: 'View Requests', onPress: () => router.replace('/customer/requests' as any) }],
    );
  } catch (err: any) {
    Alert.alert('Failed', err.message ?? 'Could not place order. Try again.');
  } finally {
    setLoading(false);
  }
}

  return (
    <View style={st.container}>
      <Stepper current={step} />

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── STEP 1: SIZE ─────────────────────────────── */}
        {step === 'size' && (
          <View style={st.stepCard}>
            <View style={st.stepHeader}>
              <Ionicons name="resize-outline" size={22} color="#fff" />
              <View>
                <Text style={st.stepHeaderTitle}>Property Size</Text>
                <Text style={st.stepHeaderSub}>Choose the size of your cleaning job</Text>
              </View>
            </View>
            <View style={st.stepBody}>
              <Text style={st.fieldLabel}>SELECT YOUR PROPERTY SIZE</Text>
              {SIZES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[st.optionCard, size === s && st.optionCardSelected]}
                  onPress={() => setSize(s)}
                  activeOpacity={0.8}
                >
                  <View style={[st.optionRadio, size === s && st.optionRadioSelected]}>
                    {size === s && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={[st.optionText, size === s && st.optionTextSelected]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 2: LOCATION ─────────────────────────── */}
        {step === 'location' && (
          <View style={st.stepCard}>
            <View style={st.stepHeader}>
              <Ionicons name="location-outline" size={22} color="#fff" />
              <View>
                <Text style={st.stepHeaderTitle}>Job Location</Text>
                <Text style={st.stepHeaderSub}>Where should the cleaning take place?</Text>
              </View>
            </View>
            <View style={st.stepBody}>
              <Text style={st.fieldLabel}>ADDRESS</Text>
              <View style={st.inputWrap}>
                <Ionicons name="location-outline" size={18} color={Colors.text3} />
                <TextInput
                  style={st.input}
                  placeholder="123 Main St, City, ZIP"
                  placeholderTextColor={Colors.text3}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
              </View>
              <Text style={st.hint}>Format: "Street Address, City, ZIP"</Text>

              <Text style={[st.fieldLabel, { marginTop: 16 }]}>DISTANCE FROM CITY HALL (KM)</Text>
              <View style={st.inputWrap}>
                <Ionicons name="navigate-outline" size={18} color={Colors.text3} />
                <TextInput
                  style={st.input}
                  placeholder="e.g. 5.5"
                  placeholderTextColor={Colors.text3}
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={st.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.blue600} />
                <Text style={st.infoText}>Example: "123 Main St, New York, 10001"</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── STEP 3: URGENCY & TASKS ───────────────────── */}
        {step === 'urgency' && (
          <View style={st.stepCard}>
            <View style={st.stepHeader}>
              <Ionicons name="flash-outline" size={22} color="#fff" />
              <View>
                <Text style={st.stepHeaderTitle}>Urgency & Tasks</Text>
                <Text style={st.stepHeaderSub}>Select urgency and what needs cleaning</Text>
              </View>
            </View>
            <View style={st.stepBody}>
              <Text style={st.fieldLabel}>URGENCY LEVEL</Text>
              <View style={st.urgencyRow}>
                {URGENCIES.map((u) => (
                  <TouchableOpacity
                    key={u.value}
                    style={[st.urgencyBtn, urgency === u.value && st.urgencyBtnSelected]}
                    onPress={() => setUrgency(u.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.urgencyLabel, urgency === u.value && st.urgencyLabelSelected]}>
                      {u.label}
                    </Text>
                    <Text style={st.urgencyDesc}>{u.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.fieldLabel, { marginTop: 20 }]}>
                CLEANING TASKS
                <Text style={st.taskCount}> · {tasks.length} selected</Text>
              </Text>
              <View style={st.tasksGrid}>
                {TASKS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[st.taskBtn, tasks.includes(t) && st.taskBtnSelected]}
                    onPress={() => toggleTask(t)}
                    activeOpacity={0.8}
                  >
                    <View style={[st.taskCheck, tasks.includes(t) && st.taskCheckSelected]}>
                      {tasks.includes(t) && <Ionicons name="checkmark" size={11} color="#fff" />}
                    </View>
                    <Text style={[st.taskBtnText, tasks.includes(t) && st.taskBtnTextSelected]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Live price preview */}
              {tasks.length > 0 && (
                <View style={st.pricePreview}>
                  <Text style={st.pricePreviewLabel}>Estimated Price</Text>
                  <Text style={st.pricePreviewValue}>${(price / 100).toFixed(2)}</Text>
                  <Text style={st.pricePreviewNote}>Held in escrow until job completion</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── STEP 4: CONFIRM & PAY ────────────────────── */}
        {step === 'payment' && (
          <View>
            <View style={st.stepCard}>
              <View style={[st.stepHeader, { backgroundColor: '#059669' }]}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                <View>
                  <Text style={st.stepHeaderTitle}>Review & Authorize Payment</Text>
                  <Text style={st.stepHeaderSub}>Confirm your booking before payment</Text>
                </View>
              </View>
              <View style={st.stepBody}>
                <BookingSummary
                  size={size}
                  address={address}
                  urgency={urgency}
                  tasks={tasks}
                  price={price}
                />

                {/* Payment amount */}
                <View style={st.paymentBox}>
                  <Text style={st.paymentLabel}>PAYMENT AMOUNT</Text>
                  <Text style={st.paymentValue}>${(price / 100).toFixed(2)}</Text>
                  {[
                    'Secure escrow: Funds held until job completion',
                    'Full protection: You control payment release',
                    'No surprises: Price confirmed, no hidden fees',
                  ].map((line) => (
                    <View key={line} style={st.paymentCheckRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.blue600} />
                      <Text style={st.paymentCheckText}>{line}</Text>
                    </View>
                  ))}
                </View>

                <View style={st.warningBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#92400E" />
                  <Text style={st.warningText}>
                    By proceeding, you authorize this payment. You'll control fund release after the cleaner completes the job.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Navigation buttons ─────────────────────────── */}
      <View style={st.nav}>
        {stepIdx > 0 ? (
          <TouchableOpacity style={st.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={16} color={Colors.text2} />
            <Text style={st.backBtnText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {step !== 'payment' ? (
          <TouchableOpacity
            style={[st.nextBtn, !canNext() && st.disabled]}
            onPress={goNext}
            disabled={!canNext()}
            activeOpacity={0.85}
          >
            <Text style={st.nextBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[st.nextBtn, { backgroundColor: '#059669' }, loading && st.disabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={st.nextBtnText}>Create Job & Pay</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  stepItem:       { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive:  { backgroundColor: Colors.blue600 },
  stepDotDone:    { backgroundColor: Colors.success },
  stepLabel:      { fontSize: 9, color: Colors.text3, fontWeight: '600' },
  stepLabelActive: { color: Colors.blue700 },
  stepLine:       { flex: 1, height: 2, backgroundColor: Colors.divider, marginBottom: 14 },
  stepLineDone:   { backgroundColor: Colors.success },

  scroll: { padding: 16, paddingBottom: 24 },

  // Step card
  stepCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stepHeader: {
    backgroundColor: Colors.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
  },
  stepHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  stepHeaderSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  stepBody: { padding: 18, gap: 10 },

  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text2,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  taskCount: { color: Colors.blue600, textTransform: 'none' },

  // Options (size step)
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  optionCardSelected: { borderColor: Colors.blue600, backgroundColor: Colors.blue50 },
  optionRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioSelected: { backgroundColor: Colors.blue600, borderColor: Colors.blue600 },
  optionText:         { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  optionTextSelected: { color: Colors.blue800 },

  // Location
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    padding: 14,
  },
  input: { flex: 1, fontSize: 14, color: Colors.text1, lineHeight: 20 },
  hint:  { fontSize: 12, color: Colors.text3 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.blue50,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.blue100,
  },
  infoText: { fontSize: 12, color: Colors.blue800, flex: 1 },

  // Urgency
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: Colors.divider,
    alignItems: 'center',
    gap: 4,
  },
  urgencyBtnSelected:    { borderColor: Colors.blue600, backgroundColor: Colors.blue50 },
  urgencyLabel:          { fontSize: 13, fontWeight: '700', color: Colors.text2 },
  urgencyLabelSelected:  { color: Colors.blue800 },
  urgencyDesc:           { fontSize: 10, color: Colors.text3, textAlign: 'center' },

  // Tasks
  tasksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  taskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  taskBtnSelected:     { borderColor: Colors.blue600, backgroundColor: Colors.blue50 },
  taskCheck: {
    width: 16, height: 16, borderRadius: 4,
    borderWidth: 1.5, borderColor: Colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  taskCheckSelected:   { backgroundColor: Colors.blue600, borderColor: Colors.blue600 },
  taskBtnText:         { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  taskBtnTextSelected: { color: Colors.blue800 },

  // Price preview
  pricePreview: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    marginTop: 8,
  },
  pricePreviewLabel: { fontSize: 11, fontWeight: '700', color: '#065F46', letterSpacing: 0.6, textTransform: 'uppercase' },
  pricePreviewValue: { fontSize: 32, fontWeight: '800', color: '#047857', letterSpacing: -1, marginTop: 4 },
  pricePreviewNote:  { fontSize: 11, color: '#6EE7B7', marginTop: 2 },

  // Summary
  summary: { gap: 10 },
  summaryTitle:      { fontSize: 15, fontWeight: '800', color: Colors.text1, marginBottom: 4 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface2,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  summaryKey:  { fontSize: 11, color: Colors.text3, fontWeight: '600', textTransform: 'uppercase' },
  summaryVal:  { fontSize: 13, color: Colors.text1, fontWeight: '600', flex: 1, textAlign: 'right' },
  summaryTotal: {
    backgroundColor: Colors.blue50,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.blue100,
    alignItems: 'center',
    marginTop: 6,
  },
  summaryTotalLabel: { fontSize: 11, fontWeight: '700', color: Colors.blue700, letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryTotalValue: { fontSize: 30, fontWeight: '900', color: Colors.blue600, letterSpacing: -1, marginTop: 4 },
  summaryTotalNote:  { fontSize: 11, color: Colors.blue400, marginTop: 2 },

  // Payment
  paymentBox: {
    backgroundColor: Colors.blue50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.blue100,
    padding: 18,
    gap: 10,
    marginTop: 14,
  },
  paymentLabel: { fontSize: 10, fontWeight: '700', color: Colors.blue800, letterSpacing: 1, textTransform: 'uppercase' },
  paymentValue: { fontSize: 36, fontWeight: '900', color: Colors.blue600, letterSpacing: -1 },
  paymentCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  paymentCheckText: { fontSize: 13, color: Colors.blue800, flex: 1, lineHeight: 18 },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 12,
  },
  warningText: { fontSize: 13, color: '#92400E', flex: 1, lineHeight: 18 },

  // Nav buttons
  nav: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    paddingVertical: 14,
  },
  backBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text2 },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.blue600,
    borderRadius: 12,
    paddingVertical: 14,
  },
  nextBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  disabled: { opacity: 0.4 },
});
