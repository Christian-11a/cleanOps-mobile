import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/authContext';
import { useColors } from '@/lib/themeContext';
import { getCustomerJobs } from '@/app/actions/jobs';
import { signOut } from '@/app/actions/auth';
import { StatCard } from '@/components/shared/StatCard';
import { JobCard } from '@/components/shared/JobCard';
import type { Job } from '@/types';

const { width } = Dimensions.get('window');

export default function CustomerDashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try { setJobs(await getCustomerJobs()); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const firstName     = profile?.full_name?.split(' ')[0] ?? 'Customer';
  const activeJobs    = jobs.filter((j) => j.status === 'OPEN' || j.status === 'IN_PROGRESS');
  const pendingJobs   = jobs.filter((j) => j.status === 'PENDING_REVIEW');
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');

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
              <Text style={st.greeting}>Welcome back,</Text>
              <Text style={st.name}>{firstName} 👋</Text>
            </View>
            <View style={st.headerActions}>
              <TouchableOpacity style={st.headerBtn} onPress={() => router.push('/customer/profile' as any)}>
                <Ionicons name="person-circle-outline" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <TouchableOpacity style={st.headerBtn} onPress={signOut}>
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={st.headerSub}>Overview of your recent orders and activity.</Text>
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
          <StatCard label="Active"    value={activeJobs.length}    icon="timer-outline"           color={C.blue600} />
          <StatCard label="Review"    value={pendingJobs.length}   icon="hourglass-outline"        color={C.warning} />
          <StatCard label="Completed" value={completedJobs.length} icon="checkmark-circle-outline" color={C.success} />
        </View>

        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Quick Actions</Text>
          <TouchableOpacity style={[st.primaryAction, { backgroundColor: C.blue600 }]} onPress={() => router.push('/customer/order')} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={st.primaryActionText}>New Order</Text>
          </TouchableOpacity>
          {[
            { label: 'View All Requests', icon: 'list' as const,          href: '/customer/requests' },
            { label: 'Wallet & Payments', icon: 'wallet-outline' as const, href: '/customer/payment' },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[st.secondaryAction, { backgroundColor: C.blue50, borderColor: C.blue200 }]}
              onPress={() => router.push(a.href as any)}
              activeOpacity={0.85}
            >
              <Ionicons name={a.icon} size={20} color={C.blue600} />
              <Text style={[st.secondaryActionText, { color: C.blue600 }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: C.text1 }]}>Active Orders</Text>
          {loading ? (
            <View style={[st.emptyCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Text style={[st.emptyText, { color: C.text3 }]}>Loading…</Text>
            </View>
          ) : activeJobs.length === 0 ? (
            <View style={[st.emptyCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Ionicons name="cube-outline" size={32} color={C.text3} />
              <Text style={[st.emptyText, { color: C.text3 }]}>No active orders</Text>
              <TouchableOpacity onPress={() => router.push('/customer/order')}>
                <Text style={[st.emptyLink, { color: C.blue600 }]}>Create your first order</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeJobs.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} onPress={() => router.push(`/customer/jobs/${job.id}`)} />
            ))
          )}
        </View>

        {pendingJobs.length > 0 && (
          <View style={st.section}>
            <Text style={[st.sectionTitle, { color: C.text1 }]}>Needs Your Approval</Text>
            {pendingJobs.map((job) => (
              <JobCard key={job.id} job={job} onPress={() => router.push(`/customer/jobs/${job.id}`)} actionLabel="Review & Approve" onAction={() => router.push(`/customer/jobs/${job.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingBottom: 100 },
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
  statsRow:   { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  section:    { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginBottom: 12 },
  primaryAction: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  primaryActionText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryAction: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  secondaryActionText: { fontSize: 15, fontWeight: '700' },
  emptyCard:  { borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, borderWidth: 2, borderStyle: 'dashed' },
  emptyText:  { fontSize: 14 },
  emptyLink:  { fontSize: 14, fontWeight: '700' },
});
