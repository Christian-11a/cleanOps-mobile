import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/themeContext';
import { formatTimeAgo } from '@/lib/utils';
import type { Job } from '@/types';

interface Props {
  job: Job;
  onPress: () => void;
  showClaim?: boolean;
  isClaiming?: boolean;
  onClaim?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

export function JobCard({ 
  job, 
  onPress, 
  showClaim, 
  isClaiming, 
  onClaim, 
  actionLabel, 
  onAction, 
  actionLoading 
}: Props) {
  const { colors: C, isDark, statusColors: SC } = useTheme();
  const price = job.price_amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const s = SC[job.status] ?? SC['OPEN'];
  const hasAction = showClaim || !!actionLabel;

  // Urgency logic matching Figma
  const isUrgent = job.urgency === 'HIGH';
  const urgencyColor = isUrgent ? C.error : job.urgency === 'NORMAL' ? C.warning : C.success;
  const urgencyBg = isUrgent 
    ? (isDark ? '#450a0a' : '#fee2e2') 
    : job.urgency === 'NORMAL' 
      ? (isDark ? '#451a03' : '#fef3c7') 
      : (isDark ? '#064e3b' : '#dcfce7');
  const urgencyText = isUrgent 
    ? (isDark ? '#f87171' : '#b91c1c') 
    : job.urgency === 'NORMAL' 
      ? (isDark ? '#fbbf24' : '#92400e') 
      : (isDark ? '#34d399' : '#166534');
  const urgencyLabel = isUrgent ? 'Urgent' : job.urgency === 'NORMAL' ? 'Medium' : 'Standard';

  const timeAgo = formatTimeAgo(job.created_at);
  const taskCount = job.tasks?.length || 0;
  const completedCount = 0; // Placeholder

  return (
    <TouchableOpacity
      style={[st.card, { backgroundColor: C.surface, borderColor: C.divider, shadowColor: isDark ? '#000' : '#e8edf3' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={st.cardInner}>
        <View style={st.topRow}>
          <View style={st.titleContainer}>
            <Text style={[st.jobTitle, { color: C.text1 }]} numberOfLines={1}>{job.tasks?.[0] || 'Regular Clean'}</Text>
            <View style={st.locationRow}>
              <Ionicons name="location-outline" size={12} color={C.text3} />
              <Text style={[st.locationText, { color: C.text3 }]} numberOfLines={1}>
                {job.location_address || 'Address not set'}
              </Text>
            </View>
          </View>
          <View style={[st.statusBadge, { backgroundColor: s.bg }]}>
            <Text style={[st.statusText, { color: s.text }]}>{s.label}</Text>
          </View>
        </View>

        <View style={st.middleRow}>
          <View style={[st.urgencyBadge, { backgroundColor: urgencyBg }]}>
            <View style={[st.urgencyDot, { backgroundColor: urgencyColor }]} />
            <Text style={[st.urgencyText, { color: urgencyText }]}>{urgencyLabel}</Text>
          </View>
          
          <View style={st.statsRow}>
            <Text style={[st.tasksText, { color: C.text3 }]}>{completedCount}/{taskCount} tasks</Text>
            <Text style={[st.price, { color: C.text1 }]}>${price}</Text>
          </View>
        </View>

        <View style={st.bottomRow}>
          <View style={st.timeBox}>
            <Ionicons name="time-outline" size={12} color={C.text3} />
            <Text style={[st.timeText, { color: C.text3 }]}>{timeAgo}</Text>
          </View>
          
          {job.employee_name ? (
             <View style={st.workerInfo}>
               <View style={[st.workerAvatar, { backgroundColor: isDark ? C.blue800 : C.blue50 }]}>
                 <Text style={[st.avatarInitial, { color: C.blue400 }]}>{job.employee_name[0].toUpperCase()}</Text>
               </View>
               <Text style={[st.workerName, { color: C.text2 }]}>{job.employee_name}</Text>
             </View>
          ) : (
             <Text style={[st.awaitingText, { color: C.text3 }]}>Awaiting cleaner</Text>
          )}
        </View>

        {hasAction && (
          <View style={st.actions}>
            {showClaim && onClaim && (
              <TouchableOpacity
                style={[st.primaryBtn, { backgroundColor: '#0ea5e9' }, isClaiming && st.disabled]}
                onPress={onClaim}
                disabled={isClaiming}
              >
                <Text style={st.primaryBtnText}>{isClaiming ? 'Claiming…' : 'Claim Job'}</Text>
              </TouchableOpacity>
            )}
            {actionLabel && onAction && (
              <TouchableOpacity
                style={[st.primaryBtn, { backgroundColor: '#0ea5e9' }, actionLoading && st.disabled]}
                onPress={onAction}
                disabled={actionLoading}
              >
                <Text style={st.primaryBtnText}>{actionLoading ? 'Loading…' : actionLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: { 
    borderRadius: 24, 
    marginBottom: 12, 
    borderWidth: 1, 
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 }
    })
  },
  cardInner: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleContainer: { flex: 1, paddingRight: 8 },
  jobTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, fontWeight: '500' },
  
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 12, fontWeight: '600' },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tasksText: { fontSize: 12, fontWeight: '500' },
  price: { fontSize: 14, fontWeight: '700' },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, fontWeight: '500' },
  
  workerInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workerAvatar: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 8, fontWeight: '700' },
  workerName: { fontSize: 12, fontWeight: '500' },
  awaitingText: { fontSize: 12, fontWeight: '500' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn:  { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.5 },
});
