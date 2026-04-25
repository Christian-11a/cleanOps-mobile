import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator, BackHandler, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCustomerJobs, approveJobCompletion } from '@/actions/jobs';
import { useTheme } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
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

export default function CustomerJobsTab() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<FilterVal>('all');
  const [search,     setSearch]     = useState('');
  const [approving,  setApproving]  = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try { setJobs(await getCustomerJobs()); }
    catch (e) {
      if (__DEV__) console.warn(e);
      toast.show('Failed to load bookings. Pull to refresh.', 'error');
    }
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

  const filtered = jobs
    .filter((j) => filter === 'all' || j.status === filter)
    .filter((j) => {
      const q = search.toLowerCase();
      return j.location_address.toLowerCase().includes(q) || j.tasks.some(t => t.toLowerCase().includes(q));
    });

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={['#0c4a6e', '#0284c7']}
        style={[st.headerGradient, { paddingTop: insets.top + 12 }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View style={st.headerContent}>
          <View style={st.headerTextWrap}>
            <Text style={st.headerTitle}>My Bookings</Text>
            <Text style={st.headerSub}>{jobs.length} total bookings</Text>
          </View>
        </View>

        <View style={st.filtersWrapper}>
          <FlatList
            data={FILTERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.filterList}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isActive = filter === item.value;
              return (
                <TouchableOpacity
                  style={[st.filterTab, isActive ? { backgroundColor: '#fff' } : { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                  onPress={() => setFilter(item.value)}
                >
                  <Text style={[st.filterText, isActive ? { color: '#0284c7' } : { color: '#fff' }]}>
                    {item.label}
                  </Text>
                  <View style={[st.badge, isActive ? { backgroundColor: '#0284c7' } : { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={[st.badgeText, { color: '#fff' }]}>
                      {counts[item.value]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={C.blue600} />
        </View>
      ) : (
        <FlatList
          style={st.listFlex}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[st.list, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchJobs(); }}
              tintColor={C.blue600}
            />
          }
          ListHeaderComponent={
            <View style={st.searchContainer}>
              <View style={[st.searchBar, { backgroundColor: C.surface, borderColor: C.divider }]}>
                <Ionicons name="search-outline" size={17} color={C.text3} />
                <TextInput
                  style={[st.searchInput, { color: C.text1 }]}
                  placeholder="Search by address or task…"
                  placeholderTextColor={C.text3}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <JobCard 
              job={item} 
              onPress={() => router.push(`/customer/jobs/${item.id}`)}
              actionLabel={item.status === 'PENDING_REVIEW' ? 'Approve Completion' : undefined}
              actionLoading={approving === item.id}
              onAction={async () => {
                setApproving(item.id);
                try {
                  await approveJobCompletion(item.id);
                  toast.show('Job approved and payment released!');
                  fetchJobs();
                } catch (e: any) { Alert.alert('Error', e.message); }
                finally { setApproving(null); }
              }}
            />
          )}
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="document-text-outline" size={48} color={C.text3} />
              <Text style={[st.emptyText, { color: C.text1 }]}>No jobs found</Text>
              <Text style={[st.emptySub, { color: C.text3 }]}>Try adjusting your filter or search query</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingBottom: 20 },
  headerContent: { paddingHorizontal: 20, marginBottom: 20 },
  headerTextWrap: { gap: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#b8e6fe' },
  filtersWrapper: { },
  filterList: { paddingHorizontal: 20, gap: 10 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, gap: 8 },
  filterText: { fontSize: 13, fontWeight: '700' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listFlex: { flex: 1 },
  list: { padding: 16 },
  searchContainer: { marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48, borderRadius: 16, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center' },
});
