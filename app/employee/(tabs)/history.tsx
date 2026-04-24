import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, ScrollView, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getEmployeeJobs } from '@/actions/jobs';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { formatTimeAgo } from '@/lib/utils';
import type { Job } from '@/types';

export default function EmployeeHistoryScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const { profile } = useAuth();
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

  // -- Dynamic Stats --
  const completedJobs = useMemo(() => jobs.filter(j => j.status === 'COMPLETED'), [jobs]);
  
  const stats = useMemo(() => {
    const totalGross = completedJobs.reduce((s, j) => s + Number(j.price_amount), 0);
    const totalNet   = totalGross * 0.9;
    const bestJob    = [...completedJobs].sort((a, b) => Number(b.price_amount) - Number(a.price_amount))[0];
    
    return {
      totalEarned: totalNet,
      count: completedJobs.length,
      avgPayout: completedJobs.length > 0 ? (totalNet / completedJobs.length) : 0,
      bestJob
    };
  }, [completedJobs]);

  const renderHeader = () => (
    <View>
      <LinearGradient colors={['#0A0F1E', '#1e293b']} style={[st.header, { paddingTop: insets.top + 12 }]}>
        <View style={st.headerTop}>
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={st.headerTitle}>Earnings & History</Text>
            <Text style={st.headerSub}>{stats.count} jobs completed</Text>
          </View>
        </View>

        <View style={st.totalCard}>
           <Text style={st.totalLabel}>Total Earned (All Time)</Text>
           <Text style={st.totalValue}>${stats.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
           <View style={st.trendRow}>
              <Ionicons name="trending-up" size={14} color="#4ade80" />
              <Text style={st.trendText}>{stats.count} job{stats.count !== 1 ? 's' : ''} completed</Text>
           </View>
        </View>
      </LinearGradient>

      <View style={st.contentSection}>
         {/* Grid Stats */}
         <View style={st.statsGrid}>
            <View style={[st.gridItem, { backgroundColor: C.surface, borderColor: C.divider }]}>
               <Text style={st.gridVal}>{stats.count}</Text>
               <Text style={[st.gridLabel, { color: C.text3 }]}>Jobs Done</Text>
               <Text style={[st.gridSub, { color: C.text3 }]}>total</Text>
            </View>
            <View style={[st.gridItem, { backgroundColor: C.surface, borderColor: C.divider }]}>
               <Text style={st.gridVal}>{profile?.rating ? `${profile.rating.toFixed(1)} ⭐` : 'New'}</Text>
               <Text style={[st.gridLabel, { color: C.text3 }]}>Avg Rating</Text>
               <Text style={[st.gridSub, { color: C.text3 }]}>{profile?.rating ? 'out of 5' : 'No ratings yet'}</Text>
            </View>
            <View style={[st.gridItem, { backgroundColor: C.surface, borderColor: C.divider }]}>
               <Text style={st.gridVal}>${stats.avgPayout.toFixed(0)}</Text>
               <Text style={[st.gridLabel, { color: C.text3 }]}>Per Job</Text>
               <Text style={[st.gridSub, { color: C.text3 }]}>average</Text>
            </View>
         </View>

         {/* Best Payout Card */}
         {stats.bestJob && (
           <View style={[st.bestCard, { backgroundColor: C.surface, borderColor: '#fbbf24' }]}>
              <View style={[st.trophyBox, { backgroundColor: '#fef3c7' }]}>
                 <Ionicons name="trophy" size={20} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                 <Text style={[st.bestLabel, { color: C.text3 }]}>Best Payout</Text>
                 <Text style={[st.bestTitle, { color: C.text1 }]}>{stats.bestJob.size || 'Home'} Clean</Text>
                 <Text style={st.bestAmt}>${(Number(stats.bestJob.price_amount) * 0.9).toFixed(2)} earned</Text>
              </View>
           </View>
         )}

         {/* Fee Info */}
         <View style={[st.feeBanner, { backgroundColor: C.surface2, borderColor: C.divider }]}>
            <Ionicons name="information-circle" size={18} color={C.text3} />
            <Text style={[st.feeText, { color: C.text3 }]}>
              Platform fee: 10% per job. You keep 90% of every payment.
            </Text>
         </View>

         <Text style={[st.listTitle, { color: C.text1 }]}>Completed Jobs</Text>
      </View>
    </View>
  );

  const renderJobItem = ({ item }: { item: Job }) => {
    const myEarning = Number(item.price_amount) * 0.9;
    const fee = Number(item.price_amount) * 0.1;
    const dateStr = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
      <TouchableOpacity 
        style={[st.jobCard, { backgroundColor: C.surface, borderColor: C.divider }]}
        onPress={() => router.push(`/employee/jobs/${item.id}`)}
      >
        <View style={st.cardHeader}>
           <View style={{ flex: 1 }}>
              <Text style={[st.jobTitle, { color: C.text1 }]}>{item.size || 'Home'} Cleaning</Text>
              <View style={st.jobSub}>
                 <Ionicons name="location-outline" size={10} color={C.text3} />
                 <Text style={[st.jobLoc, { color: C.text3 }]} numberOfLines={1}>{item.location_address}</Text>
              </View>
           </View>
           <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.jobNet}>+${myEarning.toFixed(2)}</Text>
              <Text style={[st.jobGross, { color: C.text3 }]}>of ${Number(item.price_amount).toFixed(0)} total</Text>
           </View>
        </View>

        <View style={[st.cardFooter, { borderTopColor: C.divider }]}>
           <View style={st.customerRow}>
              <View style={[st.custAvatar, { backgroundColor: C.surface2 }]}><Text style={[st.custText, { color: C.text1 }]}>{item.customer_name?.[0] || 'C'}</Text></View>
              <Text style={[st.custName, { color: C.text2 }]}>{item.customer_name || 'Customer'}</Text>
           </View>
           <Text style={[st.jobDate, { color: C.text3 }]}>{dateStr}</Text>
        </View>
        
        <View style={st.feeRow}>
           <Text style={[st.feeLabel, { color: C.text3 }]}>Platform fee (10%)</Text>
           <Text style={[st.feeAmt, { color: C.error }]}>-${fee.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[st.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJobItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={C.blue600} />}
        ListEmptyComponent={
          <View style={st.empty}>
            <Ionicons name="time-outline" size={48} color={C.text3} />
            <Text style={[st.emptyTitle, { color: C.text1 }]}>No history yet</Text>
            <Text style={[st.emptyDesc, { color: C.text3 }]}>Completed jobs will appear here.</Text>
          </View>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#94a3b8' },

  totalCard: { marginTop: 8 },
  totalLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  totalValue: { fontSize: 36, fontWeight: '900', color: '#fff', marginVertical: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 11, color: '#4ade80', fontWeight: '700' },

  contentSection: { padding: 16 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  gridItem: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center', gap: 2 },
  gridVal: { fontSize: 16, fontWeight: '800' },
  gridLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  gridSub: { fontSize: 9, fontWeight: '500' },

  bestCard: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, gap: 16, marginBottom: 16 },
  trophyBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bestLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  bestTitle: { fontSize: 14, fontWeight: '800', marginVertical: 2 },
  bestAmt: { fontSize: 15, fontWeight: '900', color: '#fbbf24' },

  feeBanner: { flexDirection: 'row', padding: 14, borderRadius: 16, borderWidth: 1, gap: 10, marginBottom: 24 },
  feeText: { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 16 },

  listTitle: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
  jobCard: { padding: 16, borderRadius: 24, borderWidth: 1, marginBottom: 12, marginHorizontal: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  jobTitle: { fontSize: 14, fontWeight: '800' },
  jobSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  jobLoc: { fontSize: 11, fontWeight: '500', width: 140 },
  jobNet: { fontSize: 16, fontWeight: '900', color: '#22c55e' },
  jobGross: { fontSize: 10, fontWeight: '500' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  custAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  custText: { fontSize: 10, fontWeight: '800' },
  custName: { fontSize: 12, fontWeight: '600' },
  jobDate: { fontSize: 11, fontWeight: '700' },

  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  feeLabel: { fontSize: 10, fontWeight: '600' },
  feeAmt: { fontSize: 10, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
