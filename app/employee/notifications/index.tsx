import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/themeContext';
import { getNotifications, markAllNotificationsRead, formatNotification, type DBNotification } from '@/actions/notifications';
import { formatTimeAgo } from '@/lib/utils';

export default function EmployeeNotificationsScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderItem = ({ item }: { item: DBNotification }) => {
    const { title, desc, icon, color } = formatNotification(item);
    return (
      <TouchableOpacity
        style={[st.notifCard, { backgroundColor: C.surface, borderColor: item.is_read ? C.divider : color + '60' }]}
        onPress={() => {
          const jobId = item.payload?.job_id;
          if (jobId) router.push(`/employee/jobs/${jobId}`);
        }}
        activeOpacity={0.75}
      >
        <View style={[st.notifIconWrap, { backgroundColor: color + '18' }]}>
          <Text style={st.notifEmoji}>{icon}</Text>
        </View>
        <View style={st.notifContent}>
          <View style={st.notifHeader}>
            <Text style={[st.notifTitle, { color: C.text1 }]}>{title}</Text>
            {!item.is_read && <View style={[st.unreadDot, { backgroundColor: color }]} />}
          </View>
          <Text style={[st.notifDesc, { color: C.text2 }]} numberOfLines={2}>{desc}</Text>
          <Text style={[st.notifTime, { color: C.text3 }]}>{formatTimeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={['#0A0F1E', '#1e293b']}
        style={[st.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={st.headerTop}>
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={st.titleWrap}>
            <Text style={st.title}>Notifications</Text>
            <Text style={st.subtitle}>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity style={st.markReadBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done-outline" size={16} color="#22c55e" />
              <Text style={[st.markReadText, { color: '#22c55e' }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={C.blue600} size="large" /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          contentContainerStyle={[st.listContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue600} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            notifications.length > 0
              ? <Text style={[st.sectionTitle, { color: C.text3 }]}>Recent Activity</Text>
              : null
          }
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={C.text3} />
              <Text style={[st.emptyTitle, { color: C.text1 }]}>No notifications</Text>
              <Text style={[st.emptySub, { color: C.text3 }]}>Approved jobs and payouts will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, marginLeft: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  markReadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markReadText: { fontSize: 12, fontWeight: '700' },
  listContent: { padding: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  notifCard: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12, gap: 12 },
  notifIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notifEmoji: { fontSize: 20 },
  notifContent: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifDesc: { fontSize: 13, lineHeight: 18 },
  notifTime: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
