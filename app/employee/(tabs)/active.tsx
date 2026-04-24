import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getEmployeeJobs } from '@/actions/jobs';
import { useTheme } from '@/lib/themeContext';
import { JobCard } from '@/components/shared/JobCard';
import { formatTimeAgo } from '@/lib/utils';
import type { Job, JobStatus } from '@/types';

type FilterVal = 'all' | JobStatus;

const FILTERS: { value: FilterVal; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'IN_PROGRESS',    label: 'In Progress' },
  { value: 'PENDING_REVIEW', label: 'Review' },
  { value: 'COMPLETED',      label: 'Done' },
  { value: 'CANCELLED',      label: 'Cancelled' },
];

export default function EmployeeJobsTab() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterVal>('all');
  const [search,     setSearch]     = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const all = await getEmployeeJobs();
      setJobs(all);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const counts = useMemo(() => ({
    all:            jobs.length,
    IN_PROGRESS:    jobs.filter(j => j.status === 'IN_PROGRESS').length,
    PENDING_REVIEW: jobs.filter(j => j.status === 'PENDING_REVIEW').length,
    COMPLETED:      jobs.filter(j => j.status === 'COMPLETED').length,
    CANCELLED:      jobs.filter(j => j.status === 'CANCELLED').length,
  }), [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs
      .filter(j => filter === 'all' || j.status === filter)
      .filter(j => {
        const q = search.toLowerCase();
        return j.location_address.toLowerCase().includes(q) || (j.size && j.size.toLowerCase().includes(q));
      });
  }, [jobs, filter, search]);

  const renderHeader = () => (
    <LinearGradient
      colors={['#0A0F1E', '#1e293b']}
      style={[st.header, { paddingTop: insets.top + 12 }]}
    >
      <View style={st.headerContent}>
        <View>
          <Text style={st.headerTitle}>My Jobs</Text>
          <Text style={st.headerSub}>{counts.IN_PROGRESS} active cleanings</Text>
        </View>
        <TouchableOpacity style={st.iconBtn} onPress={() => fetchJobs()}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.filterList}
        renderItem={({ item }) => {
          const active = filter === item.value;
          return (
            <TouchableOpacity 
              style={[st.filterTab, active ? { backgroundColor: '#22c55e' } : { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={() => setFilter(item.value)}
            >
              <Text style={[st.filterText, { color: active ? '#fff' : '#94a3b8' }]}>{item.label}</Text>
              <View style={[st.badge, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }]}>
                <Text style={st.badgeText}>{(counts as any)[item.value] || 0}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </LinearGradient>
  );

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />
      
      {renderHeader()}

      <View style={st.searchSection}>
        <View style={[st.searchBar, { backgroundColor: C.surface, borderColor: C.divider }]}>
          <Ionicons name="search" size={18} color={C.text3} />
          <TextInput
            style={[st.searchInput, { color: C.text1 }]}
            placeholder="Search your jobs..."
            placeholderTextColor={C.text3}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={C.blue600} size="large" /></View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={j => j.id}
          contentContainerStyle={[st.listContent, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={C.blue600} />}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[st.jobCard, { backgroundColor: C.surface, borderColor: C.divider }]}
              onPress={() => router.push(`/employee/jobs/${item.id}`)}
            >
              <View style={st.cardTop}>
                <View style={{ flex: 1 }}>
                   <Text style={[st.cardTitle, { color: C.text1 }]}>{item.size || 'Home'} Cleaning</Text>
                   <View style={st.addressRow}>
                      <Ionicons name="location-outline" size={12} color={C.text3} />
                      <Text style={[st.addressText, { color: C.text3 }]} numberOfLines={1}>{item.location_address}</Text>
                   </View>
                </View>
                <View style={st.priceCol}>
                   <Text style={[st.priceText, { color: C.text1 }]}>${Number(item.price_amount).toFixed(0)}</Text>
                   <Text style={[st.timeText, { color: C.text3 }]}>{formatTimeAgo(item.created_at)}</Text>
                </View>
              </View>
              
              <View style={st.cardFooter}>
                 <View style={[st.statusPill, { backgroundColor: C.surface2 }]}>
                    <View style={[st.statusDot, { backgroundColor: item.status === 'COMPLETED' ? C.success : (item.status === 'IN_PROGRESS' ? C.blue600 : C.warning) }]} />
                    <Text style={[st.statusText, { color: C.text2 }]}>{item.status.replace('_', ' ')}</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={16} color={C.text3} style={{ marginLeft: 'auto' }} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="file-tray-outline" size={48} color={C.text3} />
              <Text style={[st.emptyTitle, { color: C.text1 }]}>No jobs here</Text>
              <Text style={[st.emptySub, { color: C.text3 }]}>Your applied and active jobs will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 13, color: '#94a3b8' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  
  filterList: { paddingHorizontal: 20, gap: 10 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, gap: 8 },
  filterText: { fontSize: 13, fontWeight: '700' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 22, alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  searchSection: { padding: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, fontSize: 14 },

  listContent: { paddingHorizontal: 16 },
  jobCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  addressText: { fontSize: 12, flex: 1 },
  priceCol: { alignItems: 'flex-end' },
  priceText: { fontSize: 16, fontWeight: '900' },
  timeText: { fontSize: 11, marginTop: 2 },
  
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
