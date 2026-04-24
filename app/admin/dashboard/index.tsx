// Mobile equivalent of app/admin/dashboard/page.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllJobs, updateJobStatus } from '@/actions/jobs';
import { signOut } from '@/actions/auth';
import { Colors, STATUS_COLORS } from '@/constants/colors';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { StatCard } from '@/components/shared/StatCard';
import type { Job } from '@/types';

export default function AdminDashboardScreen() {
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting,     setActing]     = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try { setJobs(await getAllJobs()); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  async function handleAccept(id: string) {
    Alert.alert('Approve Job?', 'Move job to In Progress.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setActing(id + '_accept');
        try { await updateJobStatus(id, 'IN_PROGRESS'); fetchJobs(); }
        catch (err: any) { Alert.alert('Error', err.message); }
        finally { setActing(null); }
      }},
    ]);
  }

  async function handleDecline(id: string) {
    Alert.alert('Decline Job?', 'This will cancel the request.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: async () => {
        setActing(id + '_decline');
        try { await updateJobStatus(id, 'CANCELLED'); fetchJobs(); }
        catch (err: any) { Alert.alert('Error', err.message); }
        finally { setActing(null); }
      }},
    ]);
  }

  const openJobs      = jobs.filter((j) => j.status === 'OPEN');
  const activeJobs    = jobs.filter((j) => j.status === 'IN_PROGRESS');
  const pendingJobs   = jobs.filter((j) => j.status === 'PENDING_REVIEW');
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');

  return (
    <SafeAreaView style={st.safe}>
      <LinearGradient colors={['#1565C0', '#1E88E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.header}>
        <View style={st.headerTop}>
          <View>
            <Text style={st.eyebrow}>ADMIN</Text>
            <Text style={st.headerTitle}>CleanOps Dashboard</Text>
          </View>
          <TouchableOpacity style={st.signOutBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
        <Text style={st.headerSub}>Manage all jobs across the platform.</Text>
      </LinearGradient>

      <View style={st.statsRow}>
        <StatCard label="Open"   value={openJobs.length}      icon="folder-open-outline"     color={Colors.blue600} />
        <StatCard label="Active" value={activeJobs.length}    icon="timer-outline"           color={Colors.warning} />
        <StatCard label="Review" value={pendingJobs.length}   icon="hourglass-outline"        color={Colors.error} />
        <StatCard label="Done"   value={completedJobs.length} icon="checkmark-circle-outline" color={Colors.success} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={Colors.blue600} /></View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={Colors.blue600} />
          }
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="layers-outline" size={48} color={Colors.text3} />
              <Text style={st.emptyTitle}>No jobs found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={st.jobCard}>
              <View style={st.jobHeader}>
                <Text style={st.jobId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                <StatusBadge status={item.status} />
              </View>
              <View style={st.jobMeta}>
                {[
                  { icon: 'cash-outline' as const,     label: `$${Number(item.price_amount).toFixed(2)}` },
                  { icon: 'location-outline' as const,  label: item.location_address || '—' },
                  { icon: 'flash-outline' as const,     label: item.urgency },
                  { icon: 'time-outline' as const,      label: new Date(item.created_at).toLocaleDateString() },
                ].map((row) => (
                  <View key={row.label} style={st.metaRow}>
                    <Ionicons name={row.icon} size={13} color={Colors.text3} />
                    <Text style={st.metaText} numberOfLines={1}>{row.label}</Text>
                  </View>
                ))}
              </View>
              {item.tasks?.length > 0 && (
                <Text style={st.tasksList}>{item.tasks.join(' · ')}</Text>
              )}
              {item.status === 'OPEN' && (
                <View style={st.jobActions}>
                  <TouchableOpacity
                    style={[st.approveBtn, acting && st.disabled]}
                    onPress={() => handleAccept(item.id)}
                    disabled={acting !== null}
                  >
                    {acting === item.id + '_accept'
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <><Ionicons name="checkmark" size={15} color="#fff" /><Text style={st.approveBtnText}>Approve</Text></>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.declineBtn, acting && st.disabled]}
                    onPress={() => handleDecline(item.id)}
                    disabled={acting !== null}
                  >
                    {acting === item.id + '_decline'
                      ? <ActivityIndicator color={Colors.error} size="small" />
                      : <><Ionicons name="close" size={15} color={Colors.error} /><Text style={st.declineBtnText}>Decline</Text></>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.bg },
  header: { margin: 16, borderRadius: 20, padding: 20, marginBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  eyebrow:   { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle:{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  signOutBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:     { paddingHorizontal: 16, paddingBottom: 24 },
  empty:    { alignItems: 'center', paddingTop: 64, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text3 },
  jobCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.divider, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  jobHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  jobId:      { fontSize: 11, fontWeight: '700', color: Colors.text3, letterSpacing: 0.5 },
  jobMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:   { fontSize: 12, color: Colors.text2, maxWidth: 120 },
  tasksList:  { fontSize: 11, color: Colors.text3, marginBottom: 12 },
  jobActions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 10 },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  declineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#FECACA' },
  declineBtnText: { fontSize: 13, fontWeight: '700', color: Colors.error },
  disabled: { opacity: 0.5 },
});
