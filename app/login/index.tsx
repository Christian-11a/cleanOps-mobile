// Mobile equivalent of app/login/page.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signIn } from '@/actions/auth';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';

const { width } = Dimensions.get('window');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginScreen() {
  const router = useRouter();
  const C = useColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const [errors, setErrors] = useState<{ email: string; password: string }>({ email: '', password: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Forgot password modal
  const [forgotVisible,  setForgotVisible]  = useState(false);
  const [forgotEmail,    setForgotEmail]    = useState('');
  const [forgotLoading,  setForgotLoading]  = useState(false);
  const [forgotEmailErr, setForgotEmailErr] = useState('');

  const validateField = (field: 'email' | 'password', value: string) => {
    let error = '';
    if (field === 'email') {
      if (!value.trim()) error = 'Email is required';
      else if (!EMAIL_RE.test(value.trim())) error = 'Invalid email address';
    } else {
      if (!value) error = 'Password is required';
      else if (value.length < 6) error = 'Min. 6 characters';
    }
    setErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const isFormValid = EMAIL_RE.test(email.trim()) && password.length >= 6;

  async function handleLogin() {
    const ev = validateField('email', email);
    const pv = validateField('password', password);

    // Set both as touched to ensure errors are visible
    setTouched({ email: true, password: true });

    if (!ev || !pv) return;

    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Success is handled by the auth state listener in _layout.tsx
    } catch (err: any) {
      if (__DEV__) console.warn('Login error:', err);
      let msg = 'Incorrect email or password.';
      if (err.message === 'Invalid login credentials') msg = 'Invalid email or password.';
      else if (err.message) msg = err.message;

      setErrors((prev) => ({ ...prev, password: msg }));
    } finally {
      setLoading(false);
    }
  }
  async function handleForgotSubmit() {
    if (!forgotEmail.trim()) { setForgotEmailErr('Email is required.'); return; }
    if (!EMAIL_RE.test(forgotEmail.trim())) { setForgotEmailErr('Enter a valid email address.'); return; }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase());
      if (error) throw error;
      setForgotVisible(false);
      toast.show('Reset link sent. Check your inbox.');
    } catch (err: any) {
      setForgotEmailErr(err.message ?? 'Could not send reset link.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
          
          {/* Header Section */}
          <LinearGradient 
            colors={['#0c4a6e', '#0284c9', '#0ea5e9']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={[st.headerGradient, { paddingTop: Math.max(insets.top, 16) }]}
          >
            <View style={st.headerNav}>
              <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={st.headerContent}>
              <View style={st.iconContainer}>
                <Ionicons name="sparkles" size={28} color="#fff" />
              </View>
              <Text style={st.headerTitle}>CleanOps</Text>
              <Text style={st.headerSubtitle}>On-demand cleaning, made simple</Text>

              <View style={st.featuresGrid}>
                <View style={st.featurePill}>
                  <Ionicons name="navigate-outline" size={13} color="#bae6fd" />
                  <Text style={st.featureText}>Real-time GPS</Text>
                </View>
                <View style={st.featurePill}>
                  <Ionicons name="shield-checkmark-outline" size={13} color="#bae6fd" />
                  <Text style={st.featureText}>Escrow payments</Text>
                </View>
                <View style={st.featurePill}>
                  <Ionicons name="star-outline" size={13} color="#bae6fd" />
                  <Text style={st.featureText}>Verified ratings</Text>
                </View>
                <View style={st.featurePill}>
                  <Ionicons name="chatbubble-outline" size={13} color="#bae6fd" />
                  <Text style={st.featureText}>Live in-job chat</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Form Section */}
          <View style={st.formContainer}>
            <View style={st.titleContainer}>
              <Text style={[st.title, { color: C.text1 }]}>Sign in</Text>
              <Text style={[st.sub, { color: C.text3 }]}>Welcome back — enter your credentials</Text>
            </View>

            <View style={st.form}>
              {/* Email */}
              <View style={st.field}>
                <Text style={[st.label, { color: C.text3 }]}>Email address</Text>
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
                    autoCorrect={false}
                  />
                </View>
                {!!errors.email && touched.email && <Text style={[st.errorText, { color: '#ef4444' }]}>{errors.email}</Text>}
              </View>

              {/* Password */}
              <View style={st.field}>
                <View style={st.labelRow}>
                  <Text style={[st.label, { color: C.text3 }]}>Password</Text>
                  <TouchableOpacity onPress={() => { setForgotEmail(email); setForgotEmailErr(''); setForgotVisible(true); }}>
                    <Text style={[st.forgot, { color: C.blue600 }]}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
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
                {!!errors.password && touched.password && <Text style={[st.errorText, { color: '#ef4444' }]}>{errors.password}</Text>}
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[st.submitBtnWrapper, (loading || !isFormValid) && st.disabled]}
                onPress={handleLogin}
                disabled={loading || !isFormValid}
                activeOpacity={0.85}
              >
                <LinearGradient 
                  colors={['#0ea5e9', '#0284c7']} 
                  style={st.submitBtn}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={st.submitText}>Sign In</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <View style={st.divider}>
                <View style={[st.dividerLine, { backgroundColor: C.divider }]} />
                <Text style={[st.dividerText, { color: C.text3 }]}>don't have an account?</Text>
                <View style={[st.dividerLine, { backgroundColor: C.divider }]} />
              </View>

              <TouchableOpacity
                style={[st.createBtn, { backgroundColor: C.surface, borderColor: C.divider }]}
                onPress={() => router.push('/signup')}
                activeOpacity={0.85}
              >
                <Text style={[st.createText, { color: C.text3 }]}>Create an Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal visible={forgotVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={st.modalOverlay} behavior="padding">
          <View style={[st.modalSheet, { backgroundColor: C.surface }]}>
            <View style={[st.modalHeader, { borderBottomColor: C.divider }]}>
              <Text style={[st.modalTitle, { color: C.text1 }]}>Reset Password</Text>
              <TouchableOpacity onPress={() => setForgotVisible(false)}>
                <Ionicons name="close" size={22} color={C.text2} />
              </TouchableOpacity>
            </View>
            <View style={st.modalBody}>
              <Text style={[st.modalDesc, { color: C.text3 }]}>
                Enter your email and we'll send you a link to reset your password.
              </Text>
              <Text style={[st.label, { color: C.text2, marginTop: 12 }]}>EMAIL</Text>
              <View style={[st.inputRow, { borderColor: forgotEmailErr ? '#ef4444' : C.divider, backgroundColor: C.bg }]}>
                <TextInput
                  style={[st.input, { color: C.text1 }]}
                  placeholder="you@example.com"
                  placeholderTextColor={C.text3}
                  value={forgotEmail}
                  onChangeText={(v) => { setForgotEmail(v); if (forgotEmailErr) setForgotEmailErr(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
              {!!forgotEmailErr && <Text style={[st.errorText, { color: '#ef4444' }]}>{forgotEmailErr}</Text>}
              
              <TouchableOpacity
                style={[st.submitBtnWrapper, (forgotLoading || !EMAIL_RE.test(forgotEmail)) && st.disabled, { marginTop: 16 }]}
                onPress={handleForgotSubmit}
                disabled={forgotLoading || !EMAIL_RE.test(forgotEmail)}
              >
                <LinearGradient 
                  colors={['#0ea5e9', '#0284c7']} 
                  style={st.submitBtn}
                >
                  {forgotLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={st.submitText}>Send Reset Link</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  headerGradient: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#b8e6fe',
    marginBottom: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 340,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    minWidth: 140,
  },
  featureText: {
    fontSize: 11,
    color: '#bae6fd',
    fontWeight: '500',
  },

  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  titleContainer: {
    marginBottom: 24,
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: '700' },
  sub:   { fontSize: 14 },

  form: { gap: 16 },
  field: { marginBottom: 4 },
  label: { 
    fontSize: 12, 
    fontWeight: '600', 
    letterSpacing: 0.3, 
    textTransform: 'uppercase', 
    marginBottom: 6 
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  forgot: { fontSize: 12, fontWeight: '600' },
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
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disabled:   { opacity: 0.5 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '400' },

  createBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    fontSize: 14,
    fontWeight: '600',
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle:   { fontSize: 18, fontWeight: '700' },
  modalBody:    { padding: 20, gap: 8, paddingBottom: 40 },
  modalDesc:    { fontSize: 14, lineHeight: 20, marginBottom: 8 },
});
