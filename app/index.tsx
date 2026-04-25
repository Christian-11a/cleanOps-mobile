// Main Entry Point - CleanOps Mobile
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Dimensions, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  { icon: 'shield-checkmark-outline' as const, title: 'Vetted Cleaners' },
  { icon: 'navigate-outline'         as const, title: 'Real-time Tracking' },
  { icon: 'card-outline'             as const, title: 'Pay on Approval' },
];

const STATS = [
  { num: '4.9★', label: 'Rating' },
  { num: '2k+',  label: 'Jobs' },
  { num: '98%',  label: 'Satis.' },
];

export default function HomepageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0c4a6e', '#0284c9', '#0ea5e9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={st.safe}>
        <View style={st.container}>
          {/* Brand Header */}
          <View style={st.brand}>
            <View style={st.brandIcon}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </View>
            <Text style={st.brandName}>CleanOps</Text>
          </View>

          {/* Hero Section */}
          <View style={st.hero}>
            <Text style={st.eyebrow}>PROFESSIONAL CLEANING</Text>
            <Text style={st.headline}>Your space,{'\n'}spotless every time.</Text>
            <Text style={st.sub}>
              Book vetted cleaners, track jobs in real time, and approve work before you pay.
            </Text>
          </View>

          {/* Stats & Features (Compact for single screen) */}
          <View style={st.highlights}>
            <View style={st.statsBar}>
              {STATS.map((s, i) => (
                <React.Fragment key={s.label}>
                  <View style={st.statItem}>
                    <Text style={st.statNum}>{s.num}</Text>
                    <Text style={st.statLabel}>{s.label}</Text>
                  </View>
                  {i < STATS.length - 1 && <View style={st.statDivider} />}
                </React.Fragment>
              ))}
            </View>

            <View style={st.featuresCompact}>
              {FEATURES.map((f) => (
                <View key={f.title} style={st.featurePill}>
                  <Ionicons name={f.icon} size={14} color="#fff" />
                  <Text style={st.featurePillText}>{f.title}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={st.buttonsContainer}>
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => router.push('/signup')}
              activeOpacity={0.85}
            >
              <Text style={st.primaryBtnText}>Get started free</Text>
              <Ionicons name="arrow-forward" size={18} color="#0284c7" />
            </TouchableOpacity>

            <TouchableOpacity
              style={st.secondaryBtn}
              onPress={() => router.push('/login')}
              activeOpacity={0.85}
            >
              <Text style={st.secondaryBtnText}>Sign in to your account</Text>
            </TouchableOpacity>
          </View>

          {/* Trust indicators */}
          <View style={st.trustRow}>
            <View style={st.avatarStack}>
              {['JR', 'ML', 'AK'].map((name, i) => (
                <View key={name} style={[st.avatarItem, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}>
                  <Text style={st.avatarText}>{name}</Text>
                </View>
              ))}
            </View>
            <Text style={st.trustText}>
              Trusted by <Text style={st.trustBold}>2,000+</Text> households
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 22, fontWeight: '700', color: '#fff' },

  hero: { marginTop: 10 },
  eyebrow: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.6)', marginBottom: 12,
  },
  headline: {
    fontSize: width * 0.085,
    fontWeight: '800',
    color: '#fff',
    lineHeight: width * 0.105,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  sub: { 
    fontSize: 15, 
    color: 'rgba(255,255,255,0.8)', 
    lineHeight: 22,
  },

  highlights: { gap: 16 },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statNum:    { fontSize: 16, fontWeight: '700', color: '#fff' },
  statLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' },

  featuresCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  featurePillText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  buttonsContainer: { gap: 12 },
  primaryBtn: {
    backgroundColor: '#fff', 
    borderRadius: 16,
    height: 56,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#0284c7' },
  secondaryBtn: {
    height: 56,
    borderRadius: 16, 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', 
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatarStack: { flexDirection: 'row' },
  avatarItem: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#38bdf8',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0c4a6e',
  },
  avatarText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  trustText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  trustBold: { fontWeight: '700', color: '#fff' },
});
