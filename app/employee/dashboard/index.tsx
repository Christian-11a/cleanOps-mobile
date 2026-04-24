import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { getEmployeeJobs } from '@/actions/jobs';
import { signOut } from '@/actions/auth';
import { StatCard } from '@/components/shared/StatCard';
import { JobCard } from '@/components/shared/JobCard';
import { JobCardSkeleton } from '@/components/shared/SkeletonLoader';
import type { Job } from '@/types';

const { width } = Dimensions.get('window');

export default function EmployeeDashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try { setJobs(await getEmployeeJobs()); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const firstName     = profile?.full_name?.split(' ')[0] ?? 'Employee';
  const activeJobs    = jobs.filter((j) => j.status === 'IN_PROGRESS');
  const pendingJobs   = jobs.filter((j) => j.status === 'PENDING_REVIEW');
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');
  // Net earnings after 10% platform fee
  const totalEarnings = completedJobs.reduce((s, j) => s + Number(j.price_amount) * 0.9, 0);

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={C.blue600} />}
      >
        <LinearGradient colors={['#1565C0', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.headerCard}>
          <View style={st.headerTop}>
            <View>
              <Text style={st.greeting}>Good to see you,</Text>
              <Text style={st.name}>{firstName} 👋</Text>
            </View>
            <View style={st.headerActions}>
              <TouchableOpacity style={st.headerBtn} onPress={() => router.push('/employee/profile' as any)}>
                <Ionicons name="person-circle-outline" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <TouchableOpacity style={st.headerBtn} onPress={signOut}>
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={st.headerSub}>Overview of your work and earnings.</Text>
          {profile?.money_balance !== undefined && (
            <View style={st.balancePill}>
              <Ionicons name="wallet-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={st.balanceText}>
                Balance: <Text style={st.balanceBold}>${Number(profile.money_balance).toFixed(2)}</Text>
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={st.statsRow}>
          <StatCard label="Active"  value={activeJobs.length}    icon="timer-outline"           color={C.blue600} />
          <StatCard label="Pending" value={pendingJobs.length}   icon="hourglass-outline"        color={C.warning} />
          <StatCard label="Done"    value={completedJobs.length} icon="checkmark-circle-outline" color={C.success} />
        </View>

        <View style={[st.earningsCard, { backgroundColor: isDark ? '#064e3b' : '#ECFDF5', borderColor: isDark ? '#065f46' : '#A7F3D0' }]}>
          <View style={st.earningsLeft}>
            <Ionicons name="cash-outline" size={22} color={C.success} />
            <View>
              <Text style={[st.earningsLabel, { color: isDark ? '#34d399' : '#065F46' }]}>Total Earnings</Text>
              <Text style={[st.earningsValue, { color: isDark ? '#6ee7b7' : '#047857' }]}>${totalEarnings.toFixed(2)}</Text>
            </View>
          </View>
          <Ionicons name="trending-up-outline" size={28} color={C.success} style={{ opacity: 0.4 }} />
        </View>

        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Quick Actions</Text>
          {[
            { label: 'Browse Available Jobs', icon: 'search-outline'     as const, href: '/employee',    bg: C.blue50,  ic: C.blue600 },
            { label: 'My Jobs (In Progress)', icon: 'briefcase-outline'  as const, href: '/employee/active',  bg: isDark ? '#3b2a0a' : '#FFFBEB', ic: C.warning },
            { label: 'Job History',           icon: 'time-outline'       as const, href: '/employee/history', bg: isDark ? '#064e3b' : '#ECFDF5', ic: C.success },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[st.actionRow, { backgroundColor: C.surface, borderColor: C.divider }]}
              onPress={() => router.push(a.href as any)}
              activeOpacity={0.85}
            >
              <View style={[st.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={20} color={a.ic} />
              </View>
              <Text style={[st.actionLabel, { color: C.text1 }]}>{a.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.text3} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Recent Activity</Text>
          {loading ? (
            <><JobCardSkeleton /><JobCardSkeleton /></>
          ) : jobs.length === 0 ? (
            <View style={[st.emptyCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Ionicons name="briefcase-outline" size={32} color={C.text3} />
              <Text style={[st.emptyText, { color: C.text3 }]}>No activity yet</Text>
              <TouchableOpacity onPress={() => router.push('/employee')}>
                <Text style={[st.emptyLink, { color: C.blue600 }]}>Browse available jobs</Text>
              </TouchableOpacity>
            </View>
          ) : (
            jobs.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} onPress={() => router.push(`/employee/jobs/${job.id}`)} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { paddingBottom: 100 },
  headerCard: { margin: 16, borderRadius: 20, padding: 20 },
  headerTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  greeting:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  name:       { fontSize: Math.min(width * 0.056, 22), fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub:  { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 14 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  balancePill:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  balanceText:{ fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  balanceBold:{ fontWeight: '800', color: '#fff' },
  statsRow:   { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  earningsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 18, marginHorizontal: 16, marginBottom: 12, borderWidth: 1 },
  earningsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  earningsLabel:{ fontSize: 12, fontWeight: '600' },
  earningsValue:{ fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  section:    { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginBottom: 12 },
  actionRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 10 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel:{ flex: 1, fontSize: 15, fontWeight: '600' },
  emptyCard:  { borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, borderWidth: 2, borderStyle: 'dashed' },
  emptyText:  { fontSize: 14 },
  emptyLink:  { fontSize: 14, fontWeight: '700' },
});
