// Mobile equivalent of app/customer/dashboard/page.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/authContext';
import { getCustomerJobs } from '@/app/actions/jobs';
import { signOut } from '@/app/actions/auth';
import { Colors } from '@/constants/colors';
import { StatCard } from '@/components/shared/StatCard';
import { JobCard } from '@/components/shared/JobCard';
import type { Job } from '@/types';

const { width } = Dimensions.get('window');

export default function CustomerDashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try { setJobs(await getCustomerJobs()); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const firstName    = profile?.full_name?.split(' ')[0] ?? 'Customer';
  const activeJobs   = jobs.filter((j) => j.status === 'OPEN' || j.status === 'IN_PROGRESS');
  const pendingJobs  = jobs.filter((j) => j.status === 'PENDING_REVIEW');
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchJobs(); }}
            tintColor={Colors.blue600}
          />
        }
      >
        {/* Header gradient card */}
        <LinearGradient
          colors={['#1565C0', '#1E88E5']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={st.headerCard}
        >
          <View style={st.headerTop}>
            <View>
              <Text style={st.greeting}>Welcome back,</Text>
              <Text style={st.name}>{firstName} 👋</Text>
            </View>
            <TouchableOpacity style={st.signOutBtn} onPress={signOut}>
              <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
          <Text style={st.headerSub}>Overview of your recent orders and activity.</Text>
        </LinearGradient>

        {/* Stats */}
        <View style={st.statsRow}>
          <StatCard label="Active"    value={activeJobs.length}    icon="timer-outline"           color={Colors.blue600} />
          <StatCard label="Review"    value={pendingJobs.length}   icon="hourglass-outline"        color={Colors.warning} />
          <StatCard label="Completed" value={completedJobs.length} icon="checkmark-circle-outline" color={Colors.success} />
        </View>

        {/* Quick actions */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={st.primaryAction}
            onPress={() => router.push('/customer/order')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={st.primaryActionText}>New Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={st.secondaryAction}
            onPress={() => router.push('/customer/requests')}
            activeOpacity={0.85}
          >
            <Ionicons name="list" size={20} color={Colors.blue600} />
            <Text style={st.secondaryActionText}>View All Requests</Text>
          </TouchableOpacity>
        </View>

        {/* Active orders */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Active Orders</Text>
          {loading ? (
            <View style={st.emptyCard}>
              <Text style={st.emptyText}>Loading…</Text>
            </View>
          ) : activeJobs.length === 0 ? (
            <View style={st.emptyCard}>
              <Ionicons name="cube-outline" size={32} color={Colors.text3} />
              <Text style={st.emptyText}>No active orders</Text>
              <TouchableOpacity onPress={() => router.push('/customer/order')}>
                <Text style={st.emptyLink}>Create your first order</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeJobs.slice(0, 3).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPress={() => router.push(`/customer/jobs/${job.id}`)}
              />
            ))
          )}
        </View>

        {/* Needs approval */}
        {pendingJobs.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Needs Your Approval</Text>
            {pendingJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPress={() => router.push(`/customer/jobs/${job.id}`)}
                actionLabel="Review & Approve"
                onAction={() => router.push(`/customer/jobs/${job.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 100 },

  headerCard: { margin: 16, borderRadius: 20, padding: 20 },
  headerTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  greeting:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  name:       { fontSize: Math.min(width * 0.056, 22), fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub:  { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 14 },
  signOutBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  balanceText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  balanceBold: { fontWeight: '800', color: '#fff' },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },

  section:      { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text1, marginBottom: 12 },

  primaryAction: {
    backgroundColor: Colors.blue600, borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 10,
  },
  primaryActionText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryAction: {
    borderWidth: 1.5, borderColor: Colors.blue200, borderRadius: 14,
    paddingVertical: 14, backgroundColor: Colors.blue50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  secondaryActionText: { fontSize: 15, fontWeight: '700', color: Colors.blue600 },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 8,
    borderWidth: 2, borderColor: Colors.divider, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, color: Colors.text3 },
  emptyLink: { fontSize: 14, color: Colors.blue600, fontWeight: '700' },
});
