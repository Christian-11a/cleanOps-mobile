import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/authContext';
import { useColors } from '@/lib/themeContext';
import { getCustomerJobs } from '@/actions/jobs';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/types';

const { width } = Dimensions.get('window');

export default function CustomerProfileTab() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const C = useColors();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobsCount, setJobsCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [satisfaction, setSatisfaction] = useState<string | number>('New');

  const fetchData = useCallback(async () => {
    try {
      const jobs = await getCustomerJobs();
      setJobsCount(jobs.length);
      
      // Calculate real reviews
      // For this mockup/feedback, we'll set it to 0
      setReviewsCount(0);
      setSatisfaction('New');
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    refreshProfile();
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
      }}
    ]);
  };

  const menuItems: { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; color: string; route: string }[] = [
    { label: 'Edit Profile', sub: 'Update your info', icon: 'pencil-outline', color: '#0ea5e9', route: '/customer/profile/edit' },
    { label: 'Payment Methods', sub: 'Manage cards & billing', icon: 'card-outline', color: '#7c3aed', route: '/customer/profile/payments' },
    { label: 'Notifications', sub: 'Alert preferences', icon: 'notifications-outline', color: '#d97706', route: '/customer/profile/notifications' },
    { label: 'Privacy & Security', sub: 'Password & data', icon: 'shield-checkmark-outline', color: '#16a34a', route: '/customer/profile/security' },
    { label: 'App Settings', sub: 'Theme & display', icon: 'settings-outline', color: '#64748b', route: '/customer/profile/settings' },
    { label: 'Help & Support', sub: 'FAQs and contact', icon: 'help-circle-outline', color: '#0284c7', route: '/customer/profile/support' },
  ];

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'March 2024';

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      {/* Header Section */}
      <View style={st.headerWrapper}>
        <LinearGradient
          colors={['#0c4a6e', '#0284c7']}
          style={[st.header, { paddingTop: insets.top + 20 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={st.headerContent}>
            <View style={st.profileRow}>
              <View style={[st.avatarWrap, { backgroundColor: '#0ea5e9' }]}>
                <Text style={st.avatarText}>{(profile?.full_name ?? 'U')[0].toUpperCase()}</Text>
              </View>
              <View style={st.nameWrap}>
                <Text style={st.profileName}>{profile?.full_name || 'User'}</Text>
                <View style={st.roleBadge}>
                   <View style={st.roleDot} />
                   <Text style={st.roleText}>Customer</Text>
                </View>
              </View>
              <TouchableOpacity style={st.settingsIconBtn} onPress={() => router.push('/customer/profile/settings')}>
                <Ionicons name="settings-sharp" size={18} color="#fff" opacity={0.8} />
              </TouchableOpacity>
            </View>

            <View style={st.statsRow}>
              <View style={st.statItem}>
                <Text style={st.statValue}>{jobsCount}</Text>
                <Text style={st.statLabel}>Jobs Posted</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statItem}>
                <Text style={st.statValue}>{reviewsCount}</Text>
                <Text style={st.statLabel}>Reviews Given</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statItem}>
                <View style={st.satWrap}>
                  <Text style={st.statValue}>{satisfaction}</Text>
                  {satisfaction !== 'New' && <Ionicons name="star" size={14} color="#fbbf24" style={{ marginLeft: 4, marginTop: 2 }} />}
                </View>
                <Text style={st.statLabel}>Satisfaction</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={st.body} 
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue600} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Info Card */}
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          <Text style={[st.cardTitle, { color: C.text1 }]}>Account Info</Text>
          <View style={st.infoList}>
            <View style={st.infoRow}>
              <Text style={[st.infoLabel, { color: C.text3 }]}>Email</Text>
              <Text style={[st.infoValue, { color: C.text1 }]}>{profile?.email || 'N/A'}</Text>
            </View>
            <View style={st.infoRow}>
              <Text style={[st.infoLabel, { color: C.text3 }]}>Phone</Text>
              <Text style={[st.infoValue, { color: C.text1 }]}>{profile?.phone || 'Not set'}</Text>
            </View>
            <View style={st.infoRow}>
              <Text style={[st.infoLabel, { color: C.text3 }]}>Location</Text>
              <Text style={[st.infoValue, { color: C.text1 }]}>{profile?.location_address || 'Not set'}</Text>
            </View>
            <View style={st.infoRow}>
              <Text style={[st.infoLabel, { color: C.text3 }]}>Member Since</Text>
              <Text style={[st.infoValue, { color: C.text1 }]}>{memberSince}</Text>
            </View>
          </View>
        </View>

        {/* Reviews Section - HIDDEN IF NO REVIEWS */}
        {reviewsCount > 0 && (
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <Text style={[st.cardTitle, { color: C.text1 }]}>Your Reviews</Text>
            <View style={st.reviewItem}>
              <View style={[st.reviewAvatar, { backgroundColor: C.blue600 }]}>
                <Text style={st.reviewAvatarText}>MR</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={st.reviewHeader}>
                  <Text style={[st.reviewerName, { color: C.text1 }]}>Marcus Rivera</Text>
                  <View style={st.ratingRow}>
                    {[1,2,3,4,5].map(i => <Ionicons key={i} name="star" size={10} color="#fbbf24" />)}
                  </View>
                </View>
                <Text style={[st.reviewText, { color: C.text3 }]}>"Great job! Very thorough."</Text>
              </View>
            </View>
          </View>
        )}

        {/* Menu Items */}
        <View style={[st.menuCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity 
              key={item.label} 
              style={[st.menuItem, idx > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[st.menuIconWrap, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.menuLabel, { color: C.text1 }]}>{item.label}</Text>
                <Text style={[st.menuSub, { color: C.text3 }]}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.text3} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={st.signOutBtn} onPress={handleSignOut}>
           <LinearGradient colors={['#fff1f2', '#fff1f2']} style={[st.signOutGradient, { borderColor: '#fecdd3', borderWidth: 1 }]}>
             <Ionicons name="log-out-outline" size={20} color="#e11d48" />
             <Text style={st.signOutText}>Sign Out</Text>
           </LinearGradient>
        </TouchableOpacity>

        <Text style={[st.versionText, { color: C.text3 }]}>CleanOps v2.0 · Built with ❤️</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: {
    height: 220,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  header: { flex: 1, paddingHorizontal: 20 },
  headerContent: { gap: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { 
    width: 60, height: 60, borderRadius: 24, 
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 5 
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  nameWrap: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  roleBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7dd3fc' },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  settingsIconBtn: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingVertical: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: '#74d4ff', marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  satWrap: { flexDirection: 'row', alignItems: 'center' },

  body: { flex: 1, padding: 16 },
  card: { padding: 18, borderRadius: 24, borderWidth: 1, gap: 16, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoList: { gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 14, fontWeight: '600' },

  reviewItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  reviewAvatar: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewerName: { fontSize: 13, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 12, fontStyle: 'italic' },

  menuCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '700' },
  menuSub: { fontSize: 11, marginTop: 2 },

  signOutBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 16 },
  signOutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 58 },
  signOutText: { color: '#e11d48', fontSize: 16, fontWeight: '700' },
  versionText: { textAlign: 'center', fontSize: 12, marginTop: 24 },
});
