import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/themeContext';

interface Props {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
}

export function StatCard({ label, value, icon, color }: Props) {
  const C = useColors();
  const iconColor = color ?? C.blue600;
  return (
    <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
      <View style={[st.iconWrap, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[st.value, { color: C.text1 }]}>{value}</Text>
      <Text style={[st.label, { color: C.text3 }]}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card:    { flex: 1, borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  iconWrap:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  value:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  label:   { fontSize: 11, fontWeight: '600' },
});
