// Mobile equivalent of app/signup/page.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signUp } from '@/app/actions/auth';
import { Colors } from '@/constants/colors';

const { width } = Dimensions.get('window');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Role = 'customer' | 'employee';

function passwordStrength(pw: string): { bars: number; label: string; color: string } {
  if (!pw)        return { bars: 0, label: '',       color: '' };
  if (pw.length < 6)  return { bars: 1, label: 'Weak',   color: Colors.error };
  if (pw.length < 10) return { bars: 2, label: 'Fair',   color: Colors.warning };
  return              { bars: 3, label: 'Strong', color: Colors.success };
}

export default function SignupScreen() {
  const router = useRouter();
  const [fullName,     setFullName]     = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [role,         setRole]         = useState<Role>('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const pw = passwordStrength(password);

  async function handleSignup() {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Full name, email, and password are all required.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address (e.g. you@example.com).');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp({ email, password, fullName, role });
      // navigation handled by _layout.tsx auth listener
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={st.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text2} />
          </TouchableOpacity>

          {/* Brand */}
          <View style={st.brand}>
            <LinearGradient colors={['#1565C0', '#42A5F5']} style={st.brandIcon}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </LinearGradient>
            <Text style={st.brandName}>CleanOps</Text>
          </View>

          {/* Header */}
          <Text style={st.title}>Create account</Text>
          <Text style={st.sub}>
            Already have one?{' '}
            <Link href="/login" style={st.link}>Sign in</Link>
          </Text>

          {/* Role toggle */}
          <View style={st.roleWrap}>
            <Text style={st.label}>I AM A…</Text>
            <View style={st.roleToggle}>
              {(['customer', 'employee'] as Role[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[st.roleBtn, role === r && st.roleBtnActive]}
                  onPress={() => setRole(r)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={r === 'customer' ? 'person-outline' : 'briefcase-outline'}
                    size={16}
                    color={role === r ? Colors.blue700 : Colors.text3}
                  />
                  <Text style={[st.roleBtnText, role === r && st.roleBtnTextActive]}>
                    {r === 'customer' ? 'Customer' : 'Employee'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Fields */}
          <View style={st.form}>
            {/* Full name */}
            <View style={st.field}>
              <Text style={st.label}>FULL NAME</Text>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.text3}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
                <Ionicons name="person-outline" size={18} color={Colors.text3} />
              </View>
            </View>

            {/* Email */}
            <View style={st.field}>
              <Text style={st.label}>EMAIL</Text>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.text3}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Ionicons name="mail-outline" size={18} color={Colors.text3} />
              </View>
            </View>

            {/* Password */}
            <View style={st.field}>
              <Text style={st.label}>PASSWORD</Text>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.text3}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={Colors.text3}
                  />
                </TouchableOpacity>
              </View>

              {/* Strength meter */}
              {password.length > 0 && (
                <View style={st.strengthRow}>
                  <View style={st.strengthBars}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={[st.strengthBar, i < pw.bars && { backgroundColor: pw.color }]}
                      />
                    ))}
                  </View>
                  <Text style={[st.strengthLabel, { color: pw.color }]}>{pw.label}</Text>
                </View>
              )}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[st.submitBtn, loading && st.disabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={st.submitText}>Create account</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </TouchableOpacity>

            <Text style={st.terms}>
              By signing up you agree to our{' '}
              <Text style={st.link}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={st.link}>Privacy Policy</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface2,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 28,
  },

  brand:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, fontWeight: '800', color: Colors.text1, letterSpacing: -0.3 },

  title: { fontSize: Math.min(width * 0.07, 28), fontWeight: '800', color: Colors.text1, letterSpacing: -0.4, marginBottom: 6 },
  sub:   { fontSize: 14, color: Colors.text3, marginBottom: 24 },
  link:  { color: Colors.blue600, fontWeight: '700' },

  roleWrap: { marginBottom: 22 },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface2,
    borderWidth: 1.5, borderColor: Colors.divider,
    borderRadius: 12, padding: 4, gap: 4,
    marginTop: 8,
  },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 9,
  },
  roleBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  roleBtnText:       { fontSize: 13, fontWeight: '500', color: Colors.text3 },
  roleBtnTextActive: { fontWeight: '700', color: Colors.blue700 },

  form: { gap: 0 },
  field:    { marginBottom: 18 },
  label: {
    fontSize: 10, fontWeight: '700', color: Colors.text2,
    letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 8,
  },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderWidth: 1.5, borderColor: Colors.divider,
    borderRadius: 12, paddingHorizontal: 14, height: 50, gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: Colors.text1 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.divider },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 42, textAlign: 'right' },

  submitBtn: {
    backgroundColor: Colors.blue600, borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8,
    shadowColor: Colors.blue600,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  submitText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  disabled:   { opacity: 0.55 },

  terms: { fontSize: 12, color: Colors.text3, textAlign: 'center', lineHeight: 18, marginTop: 16 },
});
