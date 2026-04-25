import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/themeContext';
import { getSettings, updateSettings, UserSettings } from '@/stores/settingsStore';

export default function NotificationsScreen() {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function toggleSetting(key: keyof UserSettings) {
    if (!settings) return;
    const val = !settings[key];
    const updated = await updateSettings({ [key]: val });
    setSettings(updated);
  }

  const options: { key: keyof UserSettings; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'pushNotifications', label: 'Push Notifications', sub: 'Instant alerts on your device', icon: 'notifications-outline' },
    { key: 'emailUpdates', label: 'Email Updates', sub: 'Summary and transaction receipts', icon: 'mail-outline' },
    { key: 'smsAlerts', label: 'SMS Alerts', sub: 'Critical job and security updates', icon: 'chatbox-ellipses-outline' },
    { key: 'promos', label: 'Promotional Offers', sub: 'Discounts and seasonal deals', icon: 'gift-outline' },
  ];

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, paddingTop: insets.top }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {!settings ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.blue600} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={st.scroll}>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            {options.map((opt, idx) => (
              <View key={opt.key} style={[st.row, idx > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}>
                <View style={[st.iconWrap, { backgroundColor: C.surface2 }]}>
                  <Ionicons name={opt.icon} size={20} color={C.blue600} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.label, { color: C.text1 }]}>{opt.label}</Text>
                  <Text style={[st.sub, { color: C.text3 }]}>{opt.sub}</Text>
                </View>
                <Switch 
                  value={settings[opt.key]} 
                  onValueChange={() => toggleSetting(opt.key)}
                  trackColor={{ false: '#cbd5e1', true: C.blue600 }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>
          <Text style={[st.footerNote, { color: C.text3 }]}>
            You can change these preferences at any time. Critical security alerts cannot be disabled.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  footerNote: { fontSize: 12, textAlign: 'center', marginTop: 24, paddingHorizontal: 20, lineHeight: 18 },
});
