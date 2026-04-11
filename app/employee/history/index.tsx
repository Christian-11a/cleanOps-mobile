// Employee Job History — shows COMPLETED and CANCELLED jobs only
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getEmployeeJobs } from '@/app/actions/jobs';
import { useColors } from '@/lib/themeContext';
import { JobCard } from '@/components/shared/JobCard';
import type { Job } from '@/types';

export default function EmployeeHistoryScreen() {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const all = await getEmployeeJobs();
      setJobs(all.filter((j) => j.status === 'COMPLETED' || j.status === 'CANCELLED'));
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]} edges={['top', 'left', 'right']}>
      <View style={[st.header, { borderBottomColor: C.divider }]}>
        <TouchableOpacity style={[st.backBtn, { backgroundColor: C.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text2} />
        </TouchableOpacity>
        <View>
          <Text style={[st.title, { color: C.text1 }]}>Job History</Text>
          <Text style={[st.sub, { color: C.text3 }]}>Completed and cancelled jobs</Text>
        </View>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={C.blue600} /></View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={C.blue600} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="time-outline" size={48} color={C.text3} />
              <Text style={[st.emptyTitle, { color: C.text1 }]}>No history yet</Text>
              <Text style={[st.emptyDesc, { color: C.text3 }]}>Completed jobs will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <JobCard job={item} onPress={() => router.push(`/employee/jobs/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub:     { fontSize: 12, marginTop: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:    { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  empty:   { alignItems: 'center', paddingTop: 64, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyDesc:  { fontSize: 14 },
});
