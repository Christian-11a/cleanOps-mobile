// Mobile equivalent of app/signup/index.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signUp } from '@/actions/auth';
import { useColors } from '@/lib/themeContext';

const { width } = Dimensions.get('window');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[a-zA-Z\s-]{2,}$/;

type Role = 'customer' | 'employee';

export default function SignupScreen() {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();

  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [email,        setEmail]        = useState('');
  const [phoneNumber,  setPhoneNumber]  = useState('+63 ');
  const [password,     setPassword]     = useState('');
  const [role,         setRole]         = useState<Role>('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const [errors, setErrors] = useState<{ firstName: string; lastName: string; email: string; phone: string; password: string }>({ 
    firstName: '', lastName: '', email: '', phone: '', password: '' 
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Phone auto-formatter for PH: +63 9XX XXX XXXX
  const formatPhoneNumber = (text: string) => {
    // Keep +63 prefix
    let cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned.startsWith('63')) cleaned = '63' + cleaned;
    
    let formatted = '+63 ';
    let mainPart = cleaned.substring(2); // After 63
    
    if (mainPart.length > 0) {
      formatted += mainPart.substring(0, 3);
      if (mainPart.length > 3) formatted += ' ' + mainPart.substring(3, 6);
      if (mainPart.length > 6) formatted += ' ' + mainPart.substring(6, 10);
    }
    
    return formatted.trim();
  };

  const handlePhoneChange = (text: string) => {
    if (text.length < 4) {
      setPhoneNumber('+63 ');
      return;
    }
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
    if (errors.phone) validateField('phone', formatted);
  };

  function getPasswordStrength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score === 0) return { bars: 0, label: '', color: '#e2e8f0' };
    if (score <= 2) return { bars: 1, label: 'Weak', color: '#ef4444' };
    if (score === 3) return { bars: 2, label: 'Fair', color: '#f59e0b' };
    return { bars: 3, label: 'Strong', color: '#10b981' };
  }

  const pwStrength = getPasswordStrength(password);

  const validateField = (field: string, value: string) => {
    let error = '';
    switch (field) {
      case 'firstName':
        if (!value.trim()) error = 'First name required';
        else if (!NAME_RE.test(value.trim())) error = 'Invalid name';
        break;
      case 'lastName':
        if (!value.trim()) error = 'Last name required';
        else if (!NAME_RE.test(value.trim())) error = 'Invalid name';
        break;
      case 'email':
        if (!value.trim()) error = 'Email required';
        else if (!EMAIL_RE.test(value.trim())) error = 'Invalid email address';
        break;
      case 'phone':
        const digits = value.replace(/[^\d]/g, '');
        if (digits.length < 12) error = 'Incomplete phone number';
        else if (!digits.startsWith('639')) error = 'Must start with 9';
        break;
      case 'password':
        if (value.length < 8) error = 'Minimum 8 characters';
        else if (!/[A-Z]/.test(value)) error = 'Need 1 uppercase letter';
        else if (!/[0-9]/.test(value)) error = 'Need 1 number';
        else if (!/[^A-Za-z0-9]/.test(value)) error = 'Need 1 special char';
        break;
    }
    setErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const isFormValid = 
    NAME_RE.test(firstName.trim()) &&
    NAME_RE.test(lastName.trim()) &&
    EMAIL_RE.test(email.trim()) &&
    phoneNumber.replace(/[^\d]/g, '').length === 12 &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  async function handleSignup() {
    // Final check
    const fv = validateField('firstName', firstName);
    const lv = validateField('lastName', lastName);
    const ev = validateField('email', email);
    const pv = validateField('phone', phoneNumber);
    const passv = validateField('password', password);

    if (!fv || !lv || !ev || !pv || !passv) return;

    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await signUp({ email, password, fullName, phoneNumber, role });
    } catch (err: any) {
      const msg: string = err.message ?? 'Sign up failed.';
      const lowerMsg = msg.toLowerCase();
      
      if (lowerMsg.includes('already registered') || lowerMsg.includes('already exists') || lowerMsg.includes('email taken')) {
        setErrors((p) => ({ ...p, email: 'Email already registered or used' }));
      } else if (lowerMsg.includes('email')) {
        setErrors((p) => ({ ...p, email: msg }));
      } else {
        setErrors((p) => ({ ...p, password: msg }));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>

          {/* Header Section */}
          <LinearGradient 
            colors={['#0c4a6e', '#0284c7']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={[st.headerGradient, { paddingTop: Math.max(insets.top, 16) }]}
          >
            <View style={st.headerContent}>
              <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={st.headerTitleRow}>
                <Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={st.headerTitle}>Create Account</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={st.formContainer}>
            {/* Role Selection */}
            <View style={st.roleSection}>
              <Text style={[st.label, { color: C.text3 }]}>I AM A...</Text>
              <View style={st.roleGrid}>
                <TouchableOpacity 
                  style={[st.roleCard, { backgroundColor: C.surface, borderColor: role === 'customer' ? C.blue600 : C.divider }, role === 'customer' && st.roleCardActive]} 
                  onPress={() => setRole('customer')}
                  activeOpacity={0.8}
                >
                  <View style={[st.roleIconBox, { backgroundColor: role === 'customer' ? C.blue600 : C.surface2 }]}>
                    <Ionicons name="person" size={18} color={role === 'customer' ? '#fff' : C.text3} />
                  </View>
                  <Text style={[st.roleCardTitle, { color: role === 'customer' ? C.blue600 : C.text1 }]}>Customer</Text>
                  <Text style={[st.roleCardSub, { color: C.text3 }]}>Post cleaning jobs</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[st.roleCard, { backgroundColor: C.surface, borderColor: role === 'employee' ? C.blue600 : C.divider }, role === 'employee' && st.roleCardActive]} 
                  onPress={() => setRole('employee')}
                  activeOpacity={0.8}
                >
                  <View style={[st.roleIconBox, { backgroundColor: role === 'employee' ? C.blue600 : C.surface2 }]}>
                    <Ionicons name="briefcase" size={18} color={role === 'employee' ? '#fff' : C.text3} />
                  </View>
                  <Text style={[st.roleCardTitle, { color: role === 'employee' ? C.blue600 : C.text1 }]}>Cleaner</Text>
                  <Text style={[st.roleCardSub, { color: C.text3 }]}>Find & claim jobs</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={st.form}>
              {/* Split Name Fields */}
              <View style={st.row}>
                <View style={[st.field, { flex: 1 }]}>
                  <Text style={[st.label, { color: C.text3 }]}>First Name</Text>
                  <View style={[st.inputRow, { borderColor: errors.firstName && touched.firstName ? '#ef4444' : C.divider, backgroundColor: C.surface }]}>
                    <TextInput
                      style={[st.input, { color: C.text1 }]}
                      placeholder="Alex"
                      placeholderTextColor={C.text3}
                      value={firstName}
                      onChangeText={(v) => { setFirstName(v); if (errors.firstName) validateField('firstName', v); }}
                      onBlur={() => { setTouched(p => ({...p, firstName: true})); validateField('firstName', firstName); }}
                      autoCapitalize="words"
                    />
                  </View>
                  {!!errors.firstName && touched.firstName && <Text style={[st.errorText, { color: '#ef4444' }]}>{errors.firstName}</Text>}
                </View>
                <View style={[st.field, { flex: 1 }]}>
                  <Text style={[st.label, { color: C.text3 }]}>Last Name</Text>
                  <View style={[st.inputRow, { borderColor: errors.lastName && touched.lastName ? '#ef4444' : C.divider, backgroundColor: C.surface }]}>
                    <TextInput
                      style={[st.input, { color: C.text1 }]}
                      placeholder="Chen"
                      placeholderTextColor={C.text3}
                      value={lastName}
                      onChangeText={(v) => { setLastName(v); if (errors.lastName) validateField('lastName', v); }}
                      onBlur={() => { setTouched(p => ({...p, lastName: true})); validateField('lastName', lastName); }}
                      autoCapitalize="words"
                    />
                  </View>
                  {!!errors.lastName && touched.lastName && <Text style={[st.errorText, { color: '#ef4444' }]}>{errors.lastName}</Text>}
                </View>
              </View>

              {/* Email */}
              <View style={st.field}>
                <Text style={[st.label, { color: C.text3 }]}>Email Address</Text>
                <View style={[st.inputRow, { borderColor: errors.email && touched.email ? '#ef4444' : C.divider, backgroundColor: C.surface }]}>
                  <TextInput
                    style={[st.input, { color: C.text1 }]}
                    placeholder="you@example.com"
                    placeholderTextColor={C.text3}
                    value={email}
                    onChangeText={(v) => { setEmail(v); if (errors.email) validateField('email', v); }}
                    onBlur={() => { setTouched(p => ({...p, email: true})); validateField('email', email); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {!!errors.email && touched.email && <Text style={[st.errorText, { color: '#ef4444' }]}>{errors.email}</Text>}
              </View>

              {/* Phone Number */}
              <View style={st.field}>
                <Text style={[st.label, { color: C.text3 }]}>Phone Number</Text>
                <View style={[st.inputRow, { borderColor: errors.phone && touched.phone ? '#ef4444' : C.divider, backgroundColor: C.surface }]}>
                  <TextInput
                    style={[st.input, { color: C.text1 }]}
                    placeholder="+63 9xx xxx xxxx"
                    placeholderTextColor={C.text3}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    onBlur={() => { setTouched(p => ({...p, phone: true})); validateField('phone', phoneNumber); }}
                    keyboardType="phone-pad"
                    maxLength={16}
                  />
                </View>
                {!!errors.phone && touched.phone && <Text style={[st.errorText, { color: '#ef4444' }]}>{errors.phone}</Text>}
              </View>

              {/* Password */}
              <View style={st.field}>
                <Text style={[st.label, { color: C.text3 }]}>Password</Text>
                <View style={[st.inputRow, { borderColor: errors.password && touched.password ? '#ef4444' : C.divider, backgroundColor: C.surface }]}>
                  <TextInput
                    style={[st.input, { color: C.text1 }]}
                    placeholder="••••••••"
                    placeholderTextColor={C.text3}
                    value={password}
                    onChangeText={(v) => { setPassword(v); if (errors.password) validateField('password', v); }}
                    onBlur={() => { setTouched(p => ({...p, password: true})); validateField('password', password); }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={st.eyeIcon}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={C.text3} />
                  </TouchableOpacity>
                </View>

                {/* Strength meter */}
                {password.length > 0 && (
                  <View style={st.strengthRow}>
                    <View style={st.strengthBars}>
                      {[0, 1, 2].map((i) => (
                        <View key={i} style={[st.strengthBar, { backgroundColor: C.divider }, i < pwStrength.bars && { backgroundColor: pwStrength.color }]} />
                      ))}
                    </View>
                    <Text style={[st.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
                  </View>
                )}
                {!!errors.password && touched.password && <Text style={[st.errorText, { color: '#ef4444' }]}>{errors.password}</Text>}
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[st.submitBtnWrapper, (loading || !isFormValid) && st.disabled]}
                onPress={handleSignup}
                disabled={loading || !isFormValid}
                activeOpacity={0.85}
              >
                <LinearGradient 
                  colors={['#0ea5e9', '#0284c7']} 
                  style={st.submitBtn}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={st.submitText}>{role === 'customer' ? 'Create Customer Account' : 'Create Cleaner Account'}</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <View style={st.footer}>
                <Text style={[st.footerText, { color: C.text3 }]}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/login')}>
                  <Text style={[st.footerLink, { color: C.blue600 }]}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  headerGradient: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  roleSection: {
    marginBottom: 20,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    height: 118,
  },
  roleCardActive: {
    borderColor: '#0284c7',
  },
  roleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  roleCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  roleCardSub: {
    fontSize: 12,
    fontWeight: '500',
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },
  form: { gap: 16 },
  field: { marginBottom: 4 },
  label: { 
    fontSize: 12, 
    fontWeight: '600', 
    letterSpacing: 0.3, 
    textTransform: 'uppercase', 
    marginBottom: 6 
  },
  errorText: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderRadius: 16, 
    paddingHorizontal: 16, 
    height: 50, 
  },
  input: { flex: 1, fontSize: 14 },
  eyeIcon: {
    paddingLeft: 12,
  },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 42, textAlign: 'right' },

  submitBtnWrapper: {
    marginTop: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  submitBtn: { 
    borderRadius: 16, 
    height: 56, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 16,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disabled:   { opacity: 0.5 },

  footer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 8,
  },
  footerText: { fontSize: 12 },
  footerLink: { fontSize: 16, fontWeight: '600' },
});
