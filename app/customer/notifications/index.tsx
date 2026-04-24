import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/themeContext';
import { getNotifications, markAllNotificationsRead, formatNotification, type DBNotification } from '@/actions/notifications';
import { formatTimeAgo } from '@/lib/utils';

export default function CustomerNotificationsScreen() {
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
    const cardBg = isDark ? C.surface : (color === '#16a34a' ? '#f0fdf4' : color === '#0284c7' ? '#e0f2fe' : '#fffbeb');
    const borderCol = isDark ? color + '40' : (color === '#16a34a' ? '#bbf7d0' : color === '#0284c7' ? '#bae6fd' : '#fde68a');

    return (
      <TouchableOpacity
        style={[st.notifCard, { backgroundColor: cardBg, borderColor: borderCol }]}
        onPress={() => {
          const jobId = item.payload?.job_id;
          if (jobId) router.push(`/customer/jobs/${jobId}`);
        }}
      >
        <View style={[st.iconBox, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.notifTop}>
            <Text style={[st.notifTitle, { color: isDark ? C.text1 : color }]}>{title}</Text>
            {!item.is_read && <View style={[st.unreadDot, { backgroundColor: color }]} />}
          </View>
          <Text style={[st.notifDesc, { color: isDark ? C.text2 : '#45556c' }]}>{desc}</Text>
          <Text style={[st.notifTime, { color: C.text3 }]}>{formatTimeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={['#0c4a6e', '#0284c7']}
        style={[st.header, { paddingTop: insets.top + 12 }]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      >
        <View style={st.headerContent}>
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Notifications</Text>
            <Text style={st.headerSub}>{unreadCount} unread</Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity style={st.markReadBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={14} color="#fff" />
              <Text style={st.markReadText}>Mark all read</Text>
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
          contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue600} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            notifications.length > 0
              ? <Text style={[st.sectionLabel, { color: C.text3 }]}>RECENT ({notifications.length})</Text>
              : null
          }
          ListEmptyComponent={
            <View style={st.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={C.text3} />
              <Text style={[st.emptyText, { color: C.text3 }]}>No notifications yet.</Text>
              <Text style={[st.emptySub, { color: C.text3 }]}>Activity from your jobs will appear here.</Text>
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
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  markReadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  markReadText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  scroll: { padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 16, marginLeft: 4 },
  notifCard: { flexDirection: 'row', padding: 16, borderRadius: 24, borderWidth: 1, gap: 12, marginBottom: 12, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 2 } }) },
  iconBox: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  notifTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  notifTitle: { fontSize: 14, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifDesc: { fontSize: 12, lineHeight: 18, fontWeight: '500', marginBottom: 4 },
  notifTime: { fontSize: 11, fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
