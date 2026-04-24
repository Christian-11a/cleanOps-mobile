import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, StatusBar, Platform, BackHandler } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/authContext';
import { getCustomerJobs } from '@/actions/jobs';
import { getProfile } from '@/actions/auth';
import { useTheme } from '@/lib/themeContext';
import { JobCard } from '@/components/shared/JobCard';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import type { Profile, Job } from '@/types';

const { width } = Dimensions.get('window');

export default function CustomerHomeTab() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { profile: authProfile, refreshProfile } = useAuth();
  const { colors: C, isDark } = useTheme();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const QUICK_ACTIONS = [
    { label: 'Book a Clean', icon: '🧹', route: '/customer/order', bgColor: isDark ? '#0c4a6e30' : '#e0f2fe', borderColor: isDark ? '#0c4a6e' : '#bae6fd', iconColor: C.blue600 },
    { label: 'My Jobs', icon: '📋', route: '/customer/jobs', bgColor: isDark ? '#3b2a0a30' : '#fef9c3', borderColor: isDark ? '#3b2a0a' : '#fef08a', iconColor: C.warning },
  ];

  // Handle Android back button
  useEffect(() => {
    const onBackPress = () => {
      const path = segments.join('/');
      // If we are at the root or main tabs, we handle it by doing nothing (preventing GO_BACK)
      if (path === 'customer/(tabs)' || path === 'customer' || !router.canGoBack()) {
        return true; 
      }
      router.back();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [segments, router]);

  const fetchData = useCallback(async () => {
    try {
      const [prof, jobList] = await Promise.all([
        getProfile(),
        getCustomerJobs()
      ]);
      // Fall back to authProfile so the greeting always shows the real name
      setProfile(prof ?? authProfile);
      setJobs(jobList || []);
    } catch (error) {
      console.error('Fetch error:', error);
      setProfile(authProfile);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    refreshProfile();
  };

  const recentJobs = jobs.slice(0, 3);
  const activeCount = jobs.filter(j => ['OPEN', 'IN_PROGRESS', 'PENDING_REVIEW'].includes(j.status)).length;
  const completedCount = jobs.filter(j => j.status === 'COMPLETED').length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userInitials = profile?.full_name ? 
    profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
    'AC';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />

      <ScrollView 
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={[st.scroll, { paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? "#fff" : C.blue600} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient 
          colors={['#0c4a6e', '#0284c9', '#0ea5e9']} 
          style={[st.header, { paddingTop: Math.max(insets.top, 20) }]}
        >
          <View style={st.headerTop}>
            <View>
              <Text style={st.greeting}>{getGreeting()} 👋</Text>
              <Text style={st.name}>{profile?.full_name || 'User'}</Text>
            </View>
            <View style={st.headerBtns}>
              <TouchableOpacity style={st.iconBtn} onPress={() => router.push('/customer/notifications')}>
                <Ionicons name="notifications-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={st.avatarBtn} onPress={() => router.push('/customer/profile')}>
                <Text style={st.avatarText}>{userInitials}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={st.balanceCard}>
            <View style={st.balanceMain}>
              <View>
                <Text style={st.balanceLabel}>Available Balance</Text>
                <Text style={st.balanceValue}>${(profile?.money_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <TouchableOpacity style={st.topUpBtn} onPress={() => router.push('/customer/wallet')}>
                <Ionicons name="wallet-outline" size={16} color="#fff" />
                <Text style={st.topUpText}>Wallet</Text>
              </TouchableOpacity>
            </View>
            <Text style={st.jobStats}>
              {activeCount} active · {completedCount} completed
            </Text>
          </View>
        </LinearGradient>

        <View style={[st.body, { backgroundColor: 'transparent' }]}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Quick Actions</Text>
          <View style={st.actionGrid}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity 
                key={action.label} 
                style={[st.actionItem, { backgroundColor: action.bgColor, borderColor: action.borderColor }]}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
              >
                <Text style={st.actionEmoji}>{action.icon}</Text>
                <Text style={[st.actionLabel, { color: action.iconColor }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={st.sectionHeader}>
            <Text style={[st.sectionTitle, { color: C.text1 }]}>3 Recent Booked Orders</Text>
            <TouchableOpacity onPress={() => router.push('/customer/jobs')}>
              <Text style={[st.seeAll, { color: C.blue600 }]}>See all <Ionicons name="chevron-forward" size={12} color={C.blue600} /></Text>
            </TouchableOpacity>
          </View>

          <View style={st.jobList}>
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <JobCard key={job.id} job={job} onPress={() => router.push(`/customer/jobs/${job.id}`)} />
              ))
            ) : (
              <TouchableOpacity 
                style={[st.emptyCard, { backgroundColor: C.surface, borderColor: C.divider }]} 
                onPress={() => router.push('/customer/order')}
              >
                <Ionicons name="sparkles" size={28} color="#0284c7" />
                <Text style={[st.emptyText, { color: C.text1 }]}>No recent orders</Text>
                <Text style={[st.emptyLink, { color: C.text3 }]}>Book your first cleaner today</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[st.sectionHeader, { marginTop: 24 }]}>
            <Text style={[st.sectionTitle, { color: C.text1 }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/customer/jobs')}>
              <Text style={[st.seeAll, { color: C.blue600 }]}>All <Ionicons name="chevron-forward" size={12} color={C.blue600} /></Text>
            </TouchableOpacity>
          </View>
          <RecentActivityFeed jobs={jobs} role="customer" loading={loading} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 15, color: '#b8e6fe', fontWeight: '500' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -4, right: 0, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  avatarBtn: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 24, padding: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  balanceMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  balanceLabel: { fontSize: 12, color: '#b8e6fe', fontWeight: '500' },
  balanceValue: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 2 },
  jobStats: { fontSize: 12, color: '#74d4ff', marginTop: 4 },
  topUpBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, gap: 6 },
  topUpText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  actionItem: { flex: 1, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 8, borderWidth: 1, gap: 4 },
  actionEmoji: { fontSize: 24 },
  actionLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seeAll: { fontSize: 12, fontWeight: '600' },
  jobList: { gap: 10 },
  emptyCard: { borderRadius: 24, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptyLink: { fontSize: 14 },
});
