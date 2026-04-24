import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/authContext';
import { useColors } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { updateProfile } from '@/actions/profile';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const C = useColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState(profile?.phone ?? '');
  const [address,   setAddress]   = useState(profile?.location_address ?? ''); 
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      const parts = profile.full_name.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setPhone(profile.phone || '');
      setAddress(profile.location_address || '');
    }
  }, [profile]);

  async function handleSave() {
    if (!firstName.trim()) { Alert.alert('Required', 'First name is required.'); return; }
    
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const phPhoneRegex = /^(09|\+639)\d{9}$/;
    if (phone && !phPhoneRegex.test(phone.replace(/\s/g, ''))) {
      Alert.alert('Invalid Phone', 'Please enter a valid PH mobile number.');
      return;
    }
    
    setSaving(true);
    try {
      await updateProfile(fullName, phone, address);
      await refreshProfile();
      toast.show('Profile updated successfully.');
      router.back();
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSaving(false); }
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, paddingTop: insets.top }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={st.avatarSection}>
            <View style={[st.avatarLarge, { backgroundColor: C.blue600 }]}>
               <Text style={st.avatarLargeText}>{firstName[0]?.toUpperCase() || 'U'}</Text>
               <TouchableOpacity style={st.cameraBtn}>
                  <Ionicons name="camera" size={16} color="#fff" />
               </TouchableOpacity>
            </View>
            <TouchableOpacity><Text style={{ color: C.blue600, fontWeight: '700', marginTop: 12 }}>Change Photo</Text></TouchableOpacity>
          </View>

          <Text style={[st.sectionHeader, { color: C.text3 }]}>PERSONAL INFORMATION</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={st.fieldGroup}>
              <Text style={[st.fieldLabelSmall, { color: C.text2 }]}>First Name</Text>
              <View style={[st.inputRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <TextInput style={[st.input, { color: C.text1 }]} value={firstName} onChangeText={setFirstName} placeholder="e.g. Alex" />
              </View>
            </View>
            <View style={st.fieldGroup}>
              <Text style={[st.fieldLabelSmall, { color: C.text2 }]}>Last Name</Text>
              <View style={[st.inputRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <TextInput style={[st.input, { color: C.text1 }]} value={lastName} onChangeText={setLastName} placeholder="e.g. Chen" />
              </View>
            </View>
          </View>

          <Text style={[st.sectionHeader, { color: C.text3, marginTop: 24 }]}>CONTACT DETAILS</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={st.fieldGroup}>
              <Text style={[st.fieldLabelSmall, { color: C.text2 }]}>Email Address</Text>
              <View style={[st.inputRow, { backgroundColor: C.surface2, borderColor: C.divider, opacity: 0.6 }]}>
                <TextInput style={[st.input, { color: C.text1 }]} value={profile?.email} editable={false} />
                <Ionicons name="lock-closed" size={14} color={C.text3} />
              </View>
            </View>
            <View style={st.fieldGroup}>
              <Text style={[st.fieldLabelSmall, { color: C.text2 }]}>Phone Number</Text>
              <View style={[st.inputRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <TextInput style={[st.input, { color: C.text1 }]} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
            </View>
          </View>

          <Text style={[st.sectionHeader, { color: C.text3, marginTop: 24 }]}>DEFAULT LOCATION</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={st.fieldGroup}>
              <Text style={[st.fieldLabelSmall, { color: C.text2 }]}>Service Address</Text>
              <View style={[st.inputRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                <TextInput style={[st.input, { color: C.text1 }]} value={address} onChangeText={setAddress} multiline />
                <Ionicons name="location-outline" size={16} color={C.text3} />
              </View>
            </View>
          </View>

          <TouchableOpacity style={[st.saveBtn, { backgroundColor: C.blue600 }, saving && st.disabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Save All Changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 60 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarLarge: { width: 100, height: 100, borderRadius: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarLargeText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  cameraBtn: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#0284c7', width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  card: { padding: 16, borderRadius: 24, borderWidth: 1, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabelSmall: { fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 52, gap: 8 },
  input: { flex: 1, fontSize: 14, fontWeight: '500' },
  saveBtn: { borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.5 },
});
