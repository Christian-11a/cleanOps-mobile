import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, ScrollView, Dimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getOpenJobs, applyForJob } from '@/actions/jobs';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import { formatTimeAgo } from '@/lib/utils';
import type { Job } from '@/types';

const { width } = Dimensions.get('window');

type Priority = 'ALL' | 'URGENT' | 'MEDIUM' | 'STANDARD';

export default function EmployeeFeedScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applying,   setClaiming]   = useState<string | null>(null);
  const [filter,     setFilter]     = useState<Priority>('ALL');

  const fetchJobs = useCallback(async () => {
    try { setJobs(await getOpenJobs()); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Cleaner';
  
  const filteredJobs = useMemo(() => {
    if (filter === 'ALL') return jobs;
    if (filter === 'URGENT') return jobs.filter(j => j.urgency === 'HIGH'); 
    if (filter === 'MEDIUM') return jobs.filter(j => j.urgency === 'NORMAL');
    return jobs.filter(j => j.urgency === 'LOW');
  }, [jobs, filter]);

  const stats = {
    open: jobs.length,
    urgent: jobs.filter(j => j.urgency === 'HIGH').length,
    pool: jobs.reduce((s, j) => s + Number(j.price_amount), 0)
  };

  async function handleClaim(jobId: string) {
    Alert.alert(
      'Apply for Job?',
      'The customer will review your profile and approve before you start cleaning.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: async () => {
          setClaiming(jobId);
          try {
            await applyForJob(jobId);
            setJobs((prev) => prev.filter((j) => j.id !== jobId));
            toast.show('Application sent! Wait for customer approval.');
          } catch (err: any) { Alert.alert('Failed', err.message ?? 'Try again.'); }
          finally { setClaiming(null); }
        }},
      ]
    );
  }

  const renderHeader = () => (
    <View>
      <LinearGradient 
        colors={['#0A0F1E', '#111827', '#0C1A2E']} 
        style={[st.headerContainer, { paddingTop: insets.top + 10 }]}
      >
        <View style={st.headerTop}>
          <View>
            <Text style={st.greeting}>Hello, {firstName} 👋</Text>
            <Text style={st.headerTitle}>Jobs Near You</Text>
          </View>
          <View style={st.headerActions}>
            <TouchableOpacity style={st.iconBtn} onPress={() => router.push('/employee/notifications')}>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={st.avatarPill} onPress={() => router.push('/employee/profile')}>
              <Text style={st.avatarText}>{firstName[0]}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Text style={st.statLabel}>Open Jobs</Text>
            <Text style={st.statValue}>{stats.open}</Text>
          </View>
          <View style={st.statCard}>
            <Text style={st.statLabel}>Urgent</Text>
            <Text style={[st.statValue, { color: '#f87171' }]}>{stats.urgent}</Text>
          </View>
          <View style={st.statCard}>
            <Text style={st.statLabel}>Payout Pool</Text>
            <Text style={[st.statValue, { color: '#4ade80' }]}>${stats.pool.toFixed(0)}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={st.contentPadding}>
        <View style={st.mapHeader}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Jobs Near You</Text>
          <View style={st.locationPill}>
            <Ionicons name="location-outline" size={12} color={C.text3} />
            <Text style={[st.locationText, { color: C.text3 }]}>Your Area</Text>
          </View>
        </View>

        <View style={[st.mapPlaceholder, { backgroundColor: '#0A0F1E' }]}>
           <LinearGradient colors={['rgba(10,15,30,0.8)', 'rgba(15,28,46,0.8)']} style={st.mapInner}>
              <View style={st.mapIndicators}>
                <View style={st.indicator}><View style={[st.dot, { backgroundColor: '#22c55e' }]} /><Text style={st.indicatorText}>You</Text></View>
                <View style={st.indicator}><View style={[st.dot, { backgroundColor: '#ef4444' }]} /><Text style={st.indicatorText}>Urgent</Text></View>
                <View style={st.indicator}><View style={[st.dot, { backgroundColor: '#f59e0b' }]} /><Text style={st.indicatorText}>Medium</Text></View>
              </View>
              <View style={st.liveBadge}>
                 <View style={[st.liveDot, { backgroundColor: '#22c55e' }]} />
                 <Text style={st.liveText}>LIVE</Text>
              </View>
              <View style={st.mapCenter}>
                 <Ionicons name="navigate" size={32} color="#22c55e" />
              </View>
              <View style={st.mapBottomPill}>
                 <Text style={st.mapInfoText}>📍 {jobs.length} open job{jobs.length !== 1 ? 's' : ''} available near you</Text>
              </View>
           </LinearGradient>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterScroll} contentContainerStyle={st.filterContent}>
           {(['ALL', 'URGENT', 'MEDIUM', 'STANDARD'] as Priority[]).map((p) => (
             <TouchableOpacity 
               key={p} 
               style={[
                 st.filterBtn, 
                 { backgroundColor: filter === p ? '#111827' : C.surface, borderColor: filter === p ? '#111827' : C.divider }
               ]}
               onPress={() => setFilter(p)}
             >
               {p !== 'ALL' && <View style={[st.filterDot, { backgroundColor: p === 'URGENT' ? '#ef4444' : p === 'MEDIUM' ? '#f59e0b' : '#22c55e' }]} />}
               <Text style={[st.filterLabel, { color: filter === p ? '#fff' : C.text2 }]}>
                 {p === 'ALL' ? `All (${jobs.length})` : p.charAt(0) + p.slice(1).toLowerCase()}
               </Text>
             </TouchableOpacity>
           ))}
        </ScrollView>

        <Text style={[st.listTitle, { color: C.text1 }]}>All Open Jobs</Text>
      </View>
    </View>
  );

  const renderJobItem = ({ item }: { item: Job }) => {
    const isUrgent = item.urgency === 'HIGH';
    const priorityLabel = isUrgent ? 'Urgent' : (item.urgency === 'NORMAL' ? 'Med' : 'Std');
    const priorityColor = isUrgent ? '#ef4444' : (item.urgency === 'NORMAL' ? '#f59e0b' : '#22c55e');
    const priorityBg = isUrgent ? '#fee2e2' : (item.urgency === 'NORMAL' ? '#fef3c7' : '#dcfce7');
    const priorityText = isUrgent ? '#b91c1c' : (item.urgency === 'NORMAL' ? '#92400e' : '#166534');

    const jobTitle = item.size ? `${item.size} Clean` : 'Home Cleaning';

    return (
      <TouchableOpacity 
        style={[st.jobCard, { backgroundColor: C.surface, borderColor: isUrgent ? '#fca5a5' : C.divider }]}
        onPress={() => router.push(`/employee/jobs/${item.id}`)}
        activeOpacity={0.9}
      >
        <View style={st.jobHeader}>
          <View style={st.jobMainInfo}>
            <View style={st.jobTitleRow}>
              <Text style={st.jobEmoji}>{isUrgent ? '🚨' : '✨'}</Text>
              <Text style={[st.jobTitle, { color: C.text1 }]} numberOfLines={1}>{jobTitle}</Text>
              <View style={st.timeRow}>
                <View style={st.timeDot} />
                <Text style={[st.timeText, { color: C.text3 }]}>{formatTimeAgo(item.created_at)}</Text>
              </View>
            </View>
            <View style={st.jobAddressRow}>
              <Ionicons name="location-outline" size={11} color={C.text3} />
              <Text style={[st.jobAddress, { color: C.text3 }]} numberOfLines={1}>{item.location_address}</Text>
            </View>
          </View>
          <View style={st.jobPriceInfo}>
            <Text style={[st.jobPrice, { color: C.text1 }]}>${Number(item.price_amount).toFixed(0)}</Text>
          </View>
        </View>

        <View style={st.jobBadges}>
          <View style={[st.badgePill, { backgroundColor: priorityBg }]}>
            <View style={[st.badgeDot, { backgroundColor: priorityColor }]} />
            <Text style={[st.badgeText, { color: priorityText }]}>{priorityLabel}</Text>
          </View>
          <View style={[st.badgePill, { backgroundColor: C.surface2 }]}>
            <Text style={[st.badgeText, { color: C.text2 }]}>📋 {item.tasks?.length ?? 4} tasks</Text>
          </View>
          <View style={[st.badgePill, { backgroundColor: '#f0fdf4' }]}>
            <Ionicons name="navigate-outline" size={10} color="#16a34a" />
            <Text style={[st.badgeText, { color: '#16a34a' }]}>{item.distance?.toFixed(1) ?? '0.4'} mi</Text>
          </View>
          
          <View style={[st.viewBtn, { backgroundColor: '#111827' }]}>
            <Text style={st.viewBtnText}>View</Text>
            <Ionicons name="chevron-forward" size={12} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[st.safe, { backgroundColor: C.bg }]}>
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJobItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={C.blue600} />
        }
        ListEmptyComponent={
          <View style={st.empty}>
            <Ionicons name="briefcase-outline" size={48} color={C.text3} />
            <Text style={[st.emptyTitle, { color: C.text1 }]}>No jobs found</Text>
            <Text style={[st.emptyDesc, { color: C.text3 }]}>Try changing your filter or check back later.</Text>
          </View>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  headerContainer: { paddingHorizontal: 20, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting: { fontSize: 11, color: '#62748e', marginBottom: 0 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -3, right: -2, backgroundColor: '#ef4444', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  notifText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  avatarPill: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statLabel: { fontSize: 11, color: '#62748e', marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff' },

  contentPadding: { paddingHorizontal: 16, paddingTop: 12 },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '800' },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 11 },
  
  mapPlaceholder: { height: 160, borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  mapInner: { flex: 1, padding: 10, justifyContent: 'space-between' },
  mapIndicators: { gap: 2 },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  indicatorText: { fontSize: 8, color: 'rgba(255,255,255,0.7)' },
  liveBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.2)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },
  liveText: { fontSize: 8, fontWeight: '700', color: '#4ade80' },
  mapCenter: { position: 'absolute', top: '35%', left: '46%' },
  mapBottomPill: { backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 16 },
  mapInfoText: { fontSize: 9, color: 'rgba(255,255,255,0.8)' },

  filterScroll: { marginBottom: 12 },
  filterContent: { gap: 6, paddingRight: 20 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 28, borderRadius: 14, borderWidth: 1 },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterLabel: { fontSize: 11, fontWeight: '600' },
  
  listTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  
  jobCard: { 
    borderRadius: 20, 
    padding: 12, 
    marginBottom: 10, 
    marginHorizontal: 12, 
    borderWidth: 1, 
    ...Platform.select({ 
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, 
      android: { elevation: 2 } 
    }) 
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  jobMainInfo: { flex: 1, gap: 2 },
  jobTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jobEmoji: { fontSize: 12 },
  jobTitle: { fontSize: 13, fontWeight: '800' },
  jobAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobAddress: { fontSize: 11, fontWeight: '500' },
  jobPriceInfo: { alignItems: 'flex-end', gap: 2 },
  jobPrice: { fontSize: 17, fontWeight: '800' },
  
  jobBadges: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 20, borderRadius: 10, borderWidth: 0.5, borderColor: 'transparent' },
  badgeDot: { width: 5, height: 5, borderRadius: 2.5 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  timeDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#94a3b8' },
  timeText: { fontSize: 11, fontWeight: '500' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 26, borderRadius: 13, marginLeft: 'auto' },
  viewBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  claimBtn: { backgroundColor: '#111827', paddingHorizontal: 14, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  claimBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
