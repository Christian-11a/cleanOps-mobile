import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { formatTimeAgo } from '@/lib/utils';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

export default function EmployeeReviewsScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  const fetchReviews = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('reviews')
        .select(`
          *,
          reviewer:reviewer_id (full_name)
        `)
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (e) {
      if (__DEV__) console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    fetchReviews();
  }, [fetchReviews]));

  const onRefresh = () => { setRefreshing(true); fetchReviews(); };

  const renderItem = ({ item }: { item: any }) => {
    const name = item.reviewer?.full_name || 'Anonymous Customer';
    
    return (
      <View style={[st.reviewCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
        <View style={st.cardHeader}>
          <View style={[st.avatar, { backgroundColor: C.blue600 }]}>
            <Text style={st.avatarText}>{(name || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.name, { color: C.text1 }]}>{name}</Text>
            <Text style={[st.time, { color: C.text3 }]}>{formatTimeAgo(item.created_at)}</Text>
          </View>
          <View style={st.ratingTag}>
            <Ionicons name="star" size={12} color="#fbbf24" />
            <Text style={st.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        
        {item.comment && (
          <Text style={[st.comment, { color: C.text2 }]}>"{item.comment}"</Text>
        )}
      </View>
    );
  };

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Clean White Header */}
      <View style={[st.header, { paddingTop: insets.top + 10, borderBottomColor: C.divider }]}>
        <TouchableOpacity style={[st.backBtn, { backgroundColor: C.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: C.text1 }]}>Reviews & Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={C.blue600} size="large" /></View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue600} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <View style={[st.emptyIcon, { backgroundColor: C.surface2 }]}>
                 <Ionicons name="star-outline" size={40} color={C.text3} />
              </View>
              <Text style={[st.emptyText, { color: C.text1 }]}>No reviews yet</Text>
              <Text style={[st.emptySub, { color: C.text3 }]}>Your ratings from completed jobs will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  reviewCard: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 12, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700' },
  ratingTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251,191,36,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#b45309' },
  comment: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

