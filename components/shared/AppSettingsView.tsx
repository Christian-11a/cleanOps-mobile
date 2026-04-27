import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useTheme } from '@/lib/themeContext';

export function AppSettingsView() {
  const router = useRouter();
  const C = useColors();
  const { colorMode, setColorMode } = useTheme();
  const insets = useSafeAreaInsets();

  const themeOptions: { label: string; value: 'light' | 'dark' | 'system'; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
    { label: 'Light Mode',  value: 'light',  icon: 'sunny-outline', desc: 'Classic bright look' },
    { label: 'Dark Mode',   value: 'dark',   icon: 'moon-outline', desc: 'Easy on the eyes at night' },
    { label: 'System', value: 'system', icon: 'phone-portrait-outline', desc: 'Matches device settings' },
  ];

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, paddingTop: insets.top }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>App Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll}>
        <Text style={[st.sectionTitle, { color: C.text1 }]}>Appearance</Text>
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          {themeOptions.map((opt, idx) => {
            const isSelected = colorMode === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[st.row, idx > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}
                onPress={() => setColorMode(opt.value)}
              >
                <View style={[st.iconWrap, { backgroundColor: isSelected ? `${C.blue600}15` : C.surface2 }]}>
                  <Ionicons name={opt.icon} size={20} color={isSelected ? C.blue600 : C.text3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.label, { color: isSelected ? C.blue600 : C.text1 }]}>{opt.label}</Text>
                  <Text style={[st.sub, { color: C.text3 }]}>{opt.desc}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={C.blue600} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[st.sectionTitle, { color: C.text1, marginTop: 32 }]}>General</Text>
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
           <View style={st.row}>
              <View style={[st.iconWrap, { backgroundColor: C.surface2 }]}>
                <Ionicons name="language-outline" size={20} color={C.text3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: C.text1 }]}>Language</Text>
                <Text style={[st.sub, { color: C.text3 }]}>English (United States)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.text3} />
           </View>
        </View>
      </ScrollView>
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
});
