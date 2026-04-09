// Mobile equivalent of app/customer/requests/page.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCustomerJobs, updateJobStatus, approveJobCompletion } from '@/app/actions/jobs';
import { Colors } from '@/constants/colors';
import { JobCard } from '@/components/shared/JobCard';
import type { Job, JobStatus } from '@/types';

type FilterVal = 'all' | JobStatus;

const FILTERS: { value: FilterVal; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'OPEN',           label: 'Open' },
  { value: 'IN_PROGRESS',    label: 'In Progress' },
  { value: 'PENDING_REVIEW', label: 'Review' },
  { value: 'COMPLETED',      label: 'Done' },
  { value: 'CANCELLED',      label: 'Cancelled' },
];

export default function CustomerRequestsScreen() {
  const router = useRouter();
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<FilterVal>('all');
  const [search,     setSearch]     = useState('');
  const [approving,  setApproving]  = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try { setJobs(await getCustomerJobs()); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const counts: Record<FilterVal, number> = {
    all:            jobs.length,
    OPEN:           jobs.filter((j) => j.status === 'OPEN').length,
    IN_PROGRESS:    jobs.filter((j) => j.status === 'IN_PROGRESS').length,
    PENDING_REVIEW: jobs.filter((j) => j.status === 'PENDING_REVIEW').length,
    COMPLETED:      jobs.filter((j) => j.status === 'COMPLETED').length,
    CANCELLED:      jobs.filter((j) => j.status === 'CANCELLED').length,
  };

  const filtered = jobs.filter((j) => {
    const matchStatus = filter === 'all' || j.status === filter;
    const matchSearch = !search ||
      j.location_address?.toLowerCase().includes(search.toLowerCase()) ||
      j.tasks.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
      j.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  async function handleApprove(id: string) {
    Alert.alert('Approve & Release Payment?', 'The cleaner will receive their payment.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setApproving(id);
        try { await approveJobCompletion(id); fetchJobs(); Alert.alert('Done!', 'Payment released ✅'); }
        catch (err: any) { Alert.alert('Error', err.message); }
        finally { setApproving(null); }
      }},
    ]);
  }

  async function handleCancel(id: string) {
    Alert.alert('Cancel Request?', 'Are you sure?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: async () => {
        setCancelling(id);
        try { await updateJobStatus(id, 'CANCELLED'); fetchJobs(); }
        catch (err: any) { Alert.alert('Error', err.message); }
        finally { setCancelling(null); }
      }},
    ]);
  }

  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.title}>My Requests</Text>
        <Text style={st.sub}>Track and manage all your cleaning service jobs</Text>
      </View>

      {/* Search */}
      <View style={st.searchBar}>
        <Ionicons name="search-outline" size={17} color={Colors.text3} />
        <TextInput
          style={st.searchInput}
          placeholder="Search by address or task…"
          placeholderTextColor={Colors.text3}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={Colors.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <FlatList
        data={FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.filterList}
        keyExtractor={(item) => item.value}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[st.filterTab, filter === item.value && st.filterTabActive]}
            onPress={() => setFilter(item.value)}
          >
            <Text style={[st.filterText, filter === item.value && st.filterTextActive]}>
              {item.label}
            </Text>
            <View style={[st.badge, filter === item.value && st.badgeActive]}>
              <Text style={[st.badgeText, filter === item.value && st.badgeTextActive]}>
                {counts[item.value]}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.blue600} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchJobs(); }}
              tintColor={Colors.blue600}
            />
          }
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.text3} />
              <Text style={st.emptyTitle}>No requests found</Text>
              <Text style={st.emptyDesc}>
                {search || filter !== 'all' ? 'Try adjusting your filters.' : "You haven't placed any orders yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View>
              <JobCard
                job={item}
                onPress={() => router.push(`/customer/jobs/${item.id}`)}
                actionLabel={item.status === 'PENDING_REVIEW' ? 'Approve & Complete' : undefined}
                onAction={item.status === 'PENDING_REVIEW' ? () => handleApprove(item.id) : undefined}
                actionLoading={approving === item.id}
              />
              {item.status === 'OPEN' && (
                <TouchableOpacity
                  style={[st.cancelBtn, cancelling === item.id && st.disabled]}
                  onPress={() => handleCancel(item.id)}
                  disabled={cancelling === item.id}
                >
                  <Text style={st.cancelBtnText}>
                    {cancelling === item.id ? 'Cancelling…' : 'Cancel Request'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  title:  { fontSize: 22, fontWeight: '800', color: Colors.text1, letterSpacing: -0.3 },
  sub:    { fontSize: 13, color: Colors.text3, marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.divider,
    paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 10, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text1 },

  filterList: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
filterTab: {
  flexDirection: 'row', alignItems: 'center', gap: 6,
  paddingHorizontal: 12,
  height: 36,                          // ← fixed height, no vertical padding
  borderRadius: 18, backgroundColor: Colors.surface,
  borderWidth: 1, borderColor: Colors.divider,
},
  filterTabActive: { backgroundColor: Colors.blue600, borderColor: Colors.blue600 },
  filterText:      { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  filterTextActive:{ color: '#fff' },
  badge: {
    backgroundColor: Colors.surface2,
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
  },
  badgeActive:     { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText:       { fontSize: 11, fontWeight: '700', color: Colors.text3 },
  badgeTextActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text1 },
  emptyDesc:  { fontSize: 14, color: Colors.text3, textAlign: 'center', paddingHorizontal: 24 },

  cancelBtn: {
    marginTop: -8, marginBottom: 12, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.error,
    borderRadius: 10, backgroundColor: '#FEF2F2',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: Colors.error },
  disabled: { opacity: 0.5 },
});
