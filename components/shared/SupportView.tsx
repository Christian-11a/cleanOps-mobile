import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/themeContext';

interface FAQ {
  q: string;
  a: string;
}

interface Props {
  title?: string;
  faqs: FAQ[];
  sectionTitle?: string;
  contactTitle?: string;
  contactButtonText?: string;
}

export function SupportView({ 
  title = 'Help & Support', 
  faqs, 
  sectionTitle = 'Frequently Asked Questions',
  contactTitle = 'Still need help?',
  contactButtonText = 'Contact Us'
}: Props) {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<number | null>(null);

  function toggle(idx: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === idx ? null : idx);
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, paddingTop: insets.top }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll}>
        <Text style={[st.sectionTitle, { color: C.text1 }]}>{sectionTitle}</Text>

        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          {faqs.map((faq, idx) => {
            const isExp = expanded === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[st.faqItem, idx > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}
                onPress={() => toggle(idx)}
                activeOpacity={0.7}
              >
                <View style={st.qRow}>
                  <Text style={[st.qText, { color: C.text1 }]}>{faq.q}</Text>
                  <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={18} color={C.text3} />
                </View>
                {isExp && <Text style={[st.aText, { color: C.text3 }]}>{faq.a}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={st.contactSection}>
          <Text style={[st.contactTitle, { color: C.text1 }]}>{contactTitle}</Text>
          <Text style={[st.contactSub, { color: C.text3 }]}>Our support team is available 24/7</Text>

          <TouchableOpacity style={[st.contactBtn, { backgroundColor: C.blue600 }]}>
            <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
            <Text style={st.contactBtnText}>{contactButtonText}</Text>
          </TouchableOpacity>
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
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  faqItem: { padding: 16 },
  qRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  qText: { fontSize: 14, fontWeight: '600', flex: 1 },
  aText: { fontSize: 13, marginTop: 12, lineHeight: 20 },
  contactSection: { alignItems: 'center', marginTop: 40, gap: 8 },
  contactTitle: { fontSize: 18, fontWeight: '800' },
  contactSub: { fontSize: 14, marginBottom: 12 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  contactBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
