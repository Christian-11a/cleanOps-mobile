import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/themeContext';
import { getSettings, updateSettings, UserSettings } from '@/stores/settingsStore';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';

export default function EmployeeSecurityScreen() {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [pwdModal, setPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });
  
  const [policyModal, setPolicyModal] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function toggleBiometrics() {
    if (!settings) return;
    const val = !settings.biometrics;
    const updated = await updateSettings({ biometrics: val });
    setSettings(updated);
  }

  async function handlePasswordChange() {
    if (pwdForm.new !== pwdForm.confirm) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (pwdForm.new.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: pwdForm.new });
      if (error) throw error;
      Alert.alert('Success', 'Password updated successfully');
      setPwdModal(false);
      setPwdForm({ current: '', new: '', confirm: '' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, paddingTop: insets.top }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Privacy & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      {!settings ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.blue600} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={st.scroll}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Authentication</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <TouchableOpacity style={st.row} onPress={() => setPwdModal(true)}>
              <View style={[st.iconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: C.text1 }]}>Change Password</Text>
                <Text style={[st.sub, { color: C.text3 }]}>Update your login credentials</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.text3} />
            </TouchableOpacity>

            <View style={[st.row, { borderTopWidth: 1, borderTopColor: C.divider }]}>
              <View style={[st.iconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                <Ionicons name="finger-print-outline" size={20} color={C.blue600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: C.text1 }]}>Enable Biometrics</Text>
                <Text style={[st.sub, { color: C.text3 }]}>Use FaceID or Fingerprint</Text>
              </View>
              <Switch 
                value={settings.biometrics} 
                onValueChange={toggleBiometrics}
                trackColor={{ false: '#cbd5e1', true: C.blue600 }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <Text style={[st.sectionTitle, { color: C.text1, marginTop: 32 }]}>Data & Privacy</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <TouchableOpacity style={st.row} onPress={() => setPolicyModal(true)}>
              <View style={[st.iconWrap, { backgroundColor: C.surface2 }]}>
                <Ionicons name="document-text-outline" size={20} color={C.text2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: C.text1 }]}>Privacy Policy</Text>
                <Text style={[st.sub, { color: C.text3 }]}>How we handle your data</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.text3} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={st.deleteBtn}>
             <Text style={st.deleteBtnText}>Request Account Deletion</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Change Password Modal */}
      <Modal visible={pwdModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: C.surface }]}>
            <Text style={[st.modalTitle, { color: C.text1 }]}>Change Password</Text>
            
            <View style={st.inputGroup}>
              <Text style={[st.inputLabel, { color: C.text3 }]}>Current Password</Text>
              <TextInput
                style={[st.input, { color: C.text1, borderColor: C.divider }]}
                secureTextEntry
                value={pwdForm.current}
                onChangeText={t => setPwdForm({ ...pwdForm, current: t })}
                placeholder="••••••••"
                placeholderTextColor={C.text3}
              />
            </View>

            <View style={st.inputGroup}>
              <Text style={[st.inputLabel, { color: C.text3 }]}>New Password</Text>
              <TextInput
                style={[st.input, { color: C.text1, borderColor: C.divider }]}
                secureTextEntry
                value={pwdForm.new}
                onChangeText={t => setPwdForm({ ...pwdForm, new: t })}
                placeholder="••••••••"
                placeholderTextColor={C.text3}
              />
            </View>

            <View style={st.inputGroup}>
              <Text style={[st.inputLabel, { color: C.text3 }]}>Confirm New Password</Text>
              <TextInput
                style={[st.input, { color: C.text1, borderColor: C.divider }]}
                secureTextEntry
                value={pwdForm.confirm}
                onChangeText={t => setPwdForm({ ...pwdForm, confirm: t })}
                placeholder="••••••••"
                placeholderTextColor={C.text3}
              />
            </View>

            <View style={st.modalActions}>
              <TouchableOpacity 
                style={[st.modalBtn, { backgroundColor: C.surface2 }]} 
                onPress={() => setPwdModal(false)}
              >
                <Text style={[st.modalBtnText, { color: C.text1 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[st.modalBtn, { backgroundColor: C.blue600 }]}
                onPress={handlePasswordChange}
              >
                <Text style={[st.modalBtnText, { color: '#fff' }]}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={policyModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: C.surface, maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[st.modalTitle, { color: C.text1, marginBottom: 0 }]}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setPolicyModal(false)}>
                <Ionicons name="close" size={24} color={C.text1} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[st.policyPara, { color: C.text2 }]}>
                <Text style={{ fontWeight: '800' }}>1. Data Collection: </Text>
                We collect information necessary for service fulfillment, including your name, email, phone number, and home address. For cleaners, we also collect background check information.
              </Text>
              <Text style={[st.policyPara, { color: C.text2 }]}>
                <Text style={{ fontWeight: '800' }}>2. Home & Pet Info: </Text>
                To provide accurate cleaning services, we store data about your home (size, rooms) and any pets to ensure cleaner safety and appropriate equipment.
              </Text>
              <Text style={[st.policyPara, { color: C.text2 }]}>
                <Text style={{ fontWeight: '800' }}>3. Data Sharing: </Text>
                Your address and specific cleaning instructions are shared with the assigned cleaner only to facilitate the requested service. We do not sell your personal data.
              </Text>
              <Text style={[st.policyPara, { color: C.text2 }]}>
                <Text style={{ fontWeight: '800' }}>4. Your Rights: </Text>
                You have the right to access, correct, or request deletion of your personal data at any time via the profile settings or by contacting support.
              </Text>
            </ScrollView>

            <TouchableOpacity 
              style={[st.modalBtn, { backgroundColor: '#22c55e', marginTop: 20 }]} 
              onPress={() => setPolicyModal(false)}
            >
              <Text style={[st.modalBtnText, { color: '#fff' }]}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  deleteBtn: { marginTop: 40, padding: 16, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalBtn: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
  policyPara: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
});

