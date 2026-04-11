import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/authContext';
import { useColors, useTheme } from '@/lib/themeContext';
import { updateProfile } from '@/app/actions/profile';
import { getBalance } from '@/app/actions/payments';

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const C = useColors();
  const { isDark, colorMode, setColorMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [name,    setName]    = useState(profile?.full_name ?? '');
  const [saving,  setSaving]  = useState(false);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    setSaving(true);
    try {
      await updateProfile(name);
      await refreshProfile();
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSaving(false); }
  }

  const themeOptions: { label: string; value: 'light' | 'dark' | 'system'; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Light',  value: 'light',  icon: 'sunny-outline' },
    { label: 'Dark',   value: 'dark',   icon: 'moon-outline' },
    { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
  ];

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]} edges={['top', 'left', 'right']}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider }]}>
        <TouchableOpacity style={[st.backBtn, { backgroundColor: C.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text2} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>My Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={[st.avatarWrap, { backgroundColor: C.blue600 }]}>
          <Text style={st.avatarText}>{(profile?.full_name ?? 'U')[0].toUpperCase()}</Text>
        </View>
        <Text style={[st.roleBadge, { color: C.text3 }]}>Customer Account</Text>

        {/* Stats */}
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          <Text style={[st.cardTitle, { color: C.text1 }]}>Account Info</Text>
          {[
            { label: 'Balance', value: `$${Number(profile?.money_balance ?? 0).toFixed(2)}` },
          ].map((row) => (
            <View key={row.label} style={[st.infoRow, { borderTopColor: C.divider }]}>
              <Text style={[st.infoLabel, { color: C.text3 }]}>{row.label}</Text>
              <Text style={[st.infoValue, { color: C.text1 }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Edit name */}
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          <Text style={[st.cardTitle, { color: C.text1 }]}>Edit Profile</Text>
          <Text style={[st.fieldLabel, { color: C.text2 }]}>FULL NAME</Text>
          <View style={[st.inputRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
            <TextInput
              style={[st.input, { color: C.text1 }]}
              placeholder="Your full name"
              placeholderTextColor={C.text3}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <Ionicons name="person-outline" size={18} color={C.text3} />
          </View>
          <TouchableOpacity
            style={[st.saveBtn, { backgroundColor: C.blue600 }, saving && st.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>

        {/* Dark mode */}
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          <Text style={[st.cardTitle, { color: C.text1 }]}>Appearance</Text>
          <View style={st.themeRow}>
            {themeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[st.themeBtn, { borderColor: colorMode === opt.value ? C.blue600 : C.divider, backgroundColor: colorMode === opt.value ? C.blue50 : C.surface2 }]}
                onPress={() => setColorMode(opt.value)}
              >
                <Ionicons name={opt.icon} size={20} color={colorMode === opt.value ? C.blue600 : C.text3} />
                <Text style={[st.themeBtnText, { color: colorMode === opt.value ? C.blue600 : C.text3 }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  topTitle:{ fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40, alignItems: 'center' },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  roleBadge:  { fontSize: 13, fontWeight: '600', marginTop: 6, marginBottom: 4 },
  card:  { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '700' },
  fieldLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 50, gap: 8 },
  input:     { flex: 1, fontSize: 15 },
  saveBtn:   { borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  disabled:  { opacity: 0.5 },
  themeRow:  { flexDirection: 'row', gap: 10 },
  themeBtn:  { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  themeBtnText: { fontSize: 12, fontWeight: '700' },
});
