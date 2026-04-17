// Mobile equivalent of components/booking/BookingForm.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { createJob } from '@/app/actions/jobs';
import { getBalance } from '@/app/actions/payments';
import { SIZES, TASKS, URGENCIES, computePrice } from '@/stores/bookingStore';
import type { JobUrgency } from '@/types';
import { KeyboardView } from '@/components/shared/KeyboardView';

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
  const { colors: C } = useTheme();
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <View style={[st.stepper, { backgroundColor: C.surface, borderBottomColor: C.divider }]}>
      {STEPS.map((step, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={step.id}>
            <View style={st.stepItem}>
              <View style={[st.stepDot, { backgroundColor: C.surface2 }, active && { backgroundColor: C.blue600 }, done && { backgroundColor: C.success }]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Ionicons name={step.icon} size={12} color={active ? '#fff' : C.text3} />}
              </View>
              <Text style={[st.stepLabel, { color: C.text3 }, (active || done) && { color: C.blue600, fontWeight: '700' }]}>
                {step.label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[st.stepLine, { backgroundColor: C.divider }, done && { backgroundColor: C.success }]} />
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
  const { colors: C } = useTheme();
  return (
    <View style={st.summary}>
      <Text style={[st.summaryTitle, { color: C.text1 }]}>Booking Summary</Text>
      {[
        { label: 'Size',     value: size },
        { label: 'Location', value: address },
        { label: 'Urgency',  value: urgency },
        { label: 'Tasks',    value: tasks.join(', ') },
      ].map((row) => (
        <View key={row.label} style={[st.summaryRow, { backgroundColor: C.surface2 }]}>
          <Text style={[st.summaryKey, { color: C.text3 }]}>{row.label}</Text>
          <Text style={[st.summaryVal, { color: C.text1 }]} numberOfLines={2}>{row.value}</Text>
        </View>
      ))}
      <View style={[st.summaryTotal, { backgroundColor: C.blue50, borderColor: C.blue100 }]}>
        <Text style={[st.summaryTotalLabel, { color: C.blue700 }]}>Estimated Total</Text>
        <Text style={[st.summaryTotalValue, { color: C.blue600 }]}>${(price / 100).toFixed(2)}</Text>
        <Text style={[st.summaryTotalNote, { color: C.blue400 }]}>Held in escrow until completion</Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BookingForm() {
  const router = useRouter();
  const { colors: C, statusColors: S, isDark } = useTheme();
  const { refreshProfile } = useAuth();
  const [step,     setStep]     = useState<Step>('size');
  const [size,     setSize]     = useState('');
  const [address,  setAddress]  = useState('');
  const [distance, setDistance] = useState('');
  const [urgency,  setUrgency]  = useState<JobUrgency>('NORMAL');
  const [tasks,    setTasks]    = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
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
      size,
      customInstructions: customInstructions.trim(),
    });

    // Refresh profile to sync balance on dashboard
    await refreshProfile();

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
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <Stepper current={step} />

      <KeyboardView
        contentContainerStyle={st.scroll}
stickyFooter={
          <View style={[st.nav, { backgroundColor: C.surface, borderTopColor: C.divider, paddingBottom: 0 }]}>
            {stepIdx > 0 ? (
              <TouchableOpacity style={[st.backBtn, { backgroundColor: C.surface2 }]} onPress={goBack}>
                <Ionicons name="arrow-back" size={16} color={C.text2} />
                <Text style={[st.backBtnText, { color: C.text2 }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {step !== 'payment' ? (
              <TouchableOpacity
                style={[st.nextBtn, { backgroundColor: C.blue600 }, !canNext() && st.disabled]}
                onPress={goNext}
                disabled={!canNext()}
                activeOpacity={0.85}
              >
                <Text style={st.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[st.nextBtn, { backgroundColor: C.success }, loading && st.disabled]}
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
        }
      >
        {/* ── STEP 1: SIZE ─────────────────────────────── */}
        {step === 'size' && (
          <View style={[st.stepCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={[st.stepHeader, { backgroundColor: C.blue600 }]}>
              <Ionicons name="resize-outline" size={22} color="#fff" />
              <View>
                <Text style={st.stepHeaderTitle}>Property Size</Text>
                <Text style={st.stepHeaderSub}>Choose the size of your cleaning job</Text>
              </View>
            </View>
            <View style={st.stepBody}>
              <Text style={[st.fieldLabel, { color: C.text2 }]}>SELECT YOUR PROPERTY SIZE</Text>
              {SIZES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[st.optionCard, { backgroundColor: C.surface, borderColor: C.divider }, size === s && { borderColor: C.blue600, backgroundColor: C.blue50 }]}
                  onPress={() => setSize(s)}
                  activeOpacity={0.8}
                >
                  <View style={[st.optionRadio, { borderColor: C.divider }, size === s && { backgroundColor: C.blue600, borderColor: C.blue600 }]}>
                    {size === s && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={[st.optionText, { color: C.text2 }, size === s && { color: C.blue800 }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 2: LOCATION ─────────────────────────── */}
        {step === 'location' && (
          <View style={[st.stepCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={[st.stepHeader, { backgroundColor: C.blue600 }]}>
              <Ionicons name="location-outline" size={22} color="#fff" />
              <View>
                <Text style={st.stepHeaderTitle}>Job Location</Text>
                <Text style={st.stepHeaderSub}>Where should the cleaning take place?</Text>
              </View>
            </View>
            <View style={st.stepBody}>
              <Text style={[st.fieldLabel, { color: C.text2 }]}>ADDRESS</Text>
              <View style={[st.inputWrap, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <Ionicons name="location-outline" size={18} color={C.text3} />
                <TextInput
                  style={[st.input, { color: C.text1 }]}
                  placeholder="123 Main St, City, ZIP"
                  placeholderTextColor={C.text3}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
              </View>
              <Text style={[st.hint, { color: C.text3 }]}>Format: "Street Address, City, ZIP"</Text>

              <Text style={[st.fieldLabel, { marginTop: 16, color: C.text2 }]}>DISTANCE FROM CITY HALL (KM)</Text>
              <View style={[st.inputWrap, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <Ionicons name="navigate-outline" size={18} color={C.text3} />
                <TextInput
                  style={[st.input, { color: C.text1 }]}
                  placeholder="e.g. 5.5"
                  placeholderTextColor={C.text3}
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[st.infoBox, { backgroundColor: C.blue50, borderColor: C.blue100 }]}>
                <Ionicons name="information-circle-outline" size={16} color={C.blue600} />
                <Text style={[st.infoText, { color: C.blue800 }]}>Example: "123 Main St, New York, 10001"</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── STEP 3: URGENCY & TASKS ───────────────────── */}
        {step === 'urgency' && (
          <View style={[st.stepCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={[st.stepHeader, { backgroundColor: C.blue600 }]}>
              <Ionicons name="flash-outline" size={22} color="#fff" />
              <View>
                <Text style={st.stepHeaderTitle}>Urgency & Tasks</Text>
                <Text style={st.stepHeaderSub}>Select urgency and what needs cleaning</Text>
              </View>
            </View>
            <View style={st.stepBody}>
              <Text style={[st.fieldLabel, { color: C.text2 }]}>URGENCY LEVEL</Text>
              <View style={st.urgencyRow}>
                {URGENCIES.map((u) => (
                  <TouchableOpacity
                    key={u.value}
                    style={[st.urgencyBtn, { backgroundColor: C.surface, borderColor: C.divider }, urgency === u.value && { borderColor: C.blue600, backgroundColor: C.blue50 }]}
                    onPress={() => setUrgency(u.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.urgencyLabel, { color: C.text2 }, urgency === u.value && { color: C.blue800 }]}>
                      {u.label}
                    </Text>
                    <Text style={[st.urgencyDesc, { color: C.text3 }]}>{u.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.fieldLabel, { marginTop: 20, color: C.text2 }]}>
                CLEANING TASKS
                <Text style={st.taskCount}> · {tasks.length} selected</Text>
              </Text>
              <View style={st.tasksGrid}>
                {TASKS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[st.taskBtn, { backgroundColor: C.surface, borderColor: C.divider }, tasks.includes(t) && { borderColor: C.blue600, backgroundColor: C.blue50 }]}
                    onPress={() => toggleTask(t)}
                    activeOpacity={0.8}
                  >
                    <View style={[st.taskCheck, { borderColor: C.divider }, tasks.includes(t) && { backgroundColor: C.blue600, borderColor: C.blue600 }]}>
                      {tasks.includes(t) && <Ionicons name="checkmark" size={11} color="#fff" />}
                    </View>
                    <Text style={[st.taskBtnText, { color: C.text2 }, tasks.includes(t) && { color: C.blue800 }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.fieldLabel, { marginTop: 20, color: C.text2 }]}>CUSTOM INSTRUCTIONS (OPTIONAL)</Text>
              <View style={[st.inputWrap, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <Ionicons name="create-outline" size={18} color={C.text3} />
                <TextInput
                  style={[st.input, { color: C.text1 }]}
                  placeholder="e.g. Please clean under the sofa..."
                  placeholderTextColor={C.text3}
                  value={customInstructions}
                  onChangeText={setCustomInstructions}
                  multiline
                />
              </View>

              {/* Live price preview */}
              {tasks.length > 0 && (
                <View style={[st.pricePreview, { backgroundColor: isDark ? '#064e3b' : '#ECFDF5', borderColor: isDark ? '#065f46' : '#A7F3D0' }]}>
                  <Text style={[st.pricePreviewLabel, { color: isDark ? '#34d399' : '#065F46' }]}>Estimated Price</Text>
                  <Text style={[st.pricePreviewValue, { color: isDark ? '#6ee7b7' : '#047857' }]}>${(price / 100).toFixed(2)}</Text>
                  <Text style={[st.pricePreviewNote, { color: isDark ? '#34d399' : '#6EE7B7' }]}>Held in escrow until job completion</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── STEP 4: CONFIRM & PAY ────────────────────── */}
        {step === 'payment' && (
          <View>
            <View style={[st.stepCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <View style={[st.stepHeader, { backgroundColor: isDark ? '#065f46' : '#059669' }]}>
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
                <View style={[st.paymentBox, { backgroundColor: C.blue50, borderColor: C.blue100 }]}>
                  <Text style={[st.paymentLabel, { color: C.blue800 }]}>PAYMENT AMOUNT</Text>
                  <Text style={[st.paymentValue, { color: C.blue600 }]}>${(price / 100).toFixed(2)}</Text>
                  {[
                    'Secure escrow: Funds held until job completion',
                    'Full protection: You control payment release',
                    'No surprises: Price confirmed, no hidden fees',
                  ].map((line) => (
                    <View key={line} style={st.paymentCheckRow}>
                      <Ionicons name="checkmark-circle" size={16} color={C.blue600} />
                      <Text style={[st.paymentCheckText, { color: C.blue800 }]}>{line}</Text>
                    </View>
                  ))}
                </View>

                <View style={[st.warningBox, { backgroundColor: isDark ? '#3b2a0a' : '#FFFBEB', borderColor: isDark ? '#fbbf24' : '#FDE68A' }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={isDark ? '#fbbf24' : '#92400E'} />
                  <Text style={[st.warningText, { color: isDark ? '#fef3c7' : '#92400E' }]}>
                    By proceeding, you authorize this payment. You'll control fund release after the cleaner completes the job.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </KeyboardView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  stepItem:       { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive:  { },
  stepDotDone:    { },
  stepLabel:      { fontSize: 9 },
  stepLabelActive: { },
  stepLine:       { flex: 1, height: 2, marginBottom: 14 },
  stepLineDone:   { },

  scroll: { padding: 16, paddingBottom: 24 },

  // Step card
  stepCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stepHeader: {
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
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  taskCount: { textTransform: 'none' },

  // Options (size step)
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  optionCardSelected: { },
  optionRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioSelected: { },
  optionText:         { fontSize: 14, fontWeight: '600' },
  optionTextSelected: { },

  // Location
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
  },
  input: { flex: 1, fontSize: 14, lineHeight: 20 },
  hint:  { fontSize: 12 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  infoText: { fontSize: 12, flex: 1 },

  // Urgency
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    alignItems: 'center',
    gap: 4,
  },
  urgencyBtnSelected:    { },
  urgencyLabel:          { fontSize: 13, fontWeight: '700' },
  urgencyLabelSelected:  { },
  urgencyDesc:           { fontSize: 10, textAlign: 'center' },

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
  },
  taskBtnSelected:     { },
  taskCheck: {
    width: 16, height: 16, borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  taskCheckSelected:   { },
  taskBtnText:         { fontSize: 13, fontWeight: '600' },
  taskBtnTextSelected: { },

  // Price preview
  pricePreview: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  pricePreviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  pricePreviewValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  pricePreviewNote:  { fontSize: 11, marginTop: 2 },

  // Summary
  summary: { gap: 10 },
  summaryTitle:      { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  summaryKey:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  summaryVal:  { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  summaryTotal: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 6,
  },
  summaryTotalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryTotalValue: { fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  summaryTotalNote:  { fontSize: 11, marginTop: 2 },

  // Payment
  paymentBox: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 18,
    gap: 10,
    marginTop: 14,
  },
  paymentLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  paymentValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  paymentCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  paymentCheckText: { fontSize: 13, flex: 1, lineHeight: 18 },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  warningText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Nav buttons
  nav: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 14,
  },
  backBtnText: { fontSize: 14, fontWeight: '700' },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  nextBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  disabled: { opacity: 0.4 },
});
