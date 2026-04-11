import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useStatusColors } from '@/lib/themeContext';
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

export function JobCard({ job, onPress, showClaim, isClaiming, onClaim, actionLabel, onAction, actionLoading }: Props) {
  const C = useColors();
  const SC = useStatusColors();
  const price = (job.price_amount / 100).toFixed(2);
  const hasAction = showClaim || !!actionLabel;
  const s = SC[job.status] ?? SC['OPEN'];

  return (
    <TouchableOpacity
      style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={st.topRow}>
        <View style={st.topLeft}>
          <Text style={[st.jobId, { color: C.text3 }]}>#{job.id.slice(0, 8).toUpperCase()}</Text>
          <View style={[st.badge, { backgroundColor: s.bg }]}>
            <View style={[st.dot, { backgroundColor: s.text }]} />
            <Text style={[st.badgeText, { color: s.text }]}>{s.label}</Text>
          </View>
        </View>
        <Text style={[st.price, { color: C.blue700 }]}>${price}</Text>
      </View>

      <View style={st.infoRow}>
        <View style={st.infoItem}>
          <Ionicons name="location-outline" size={13} color={C.text3} />
          <Text style={[st.infoText, { color: C.text2 }]} numberOfLines={1}>
            {job.location_address || 'Address not set'}
          </Text>
        </View>
        <View style={st.infoItem}>
          <Ionicons name="flash-outline" size={13} color={C.text3} />
          <Text style={[st.infoText, { color: C.text2 }]}>{job.urgency}</Text>
        </View>
        {job.size ? (
          <View style={st.infoItem}>
            <Ionicons name="resize-outline" size={13} color={C.text3} />
            <Text style={[st.infoText, { color: C.text2 }]} numberOfLines={1}>{job.size}</Text>
          </View>
        ) : null}
      </View>

      {job.tasks?.length > 0 && (
        <View style={st.tasksRow}>
          {job.tasks.slice(0, 4).map((t) => (
            <View key={t} style={[st.taskPill, { backgroundColor: C.blue50 }]}>
              <Text style={[st.taskText, { color: C.blue700 }]}>{t}</Text>
            </View>
          ))}
          {job.tasks.length > 4 && (
            <View style={[st.taskPill, { backgroundColor: C.blue50 }]}>
              <Text style={[st.taskText, { color: C.blue700 }]}>+{job.tasks.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {hasAction && (
        <View style={st.actions}>
          <TouchableOpacity style={[st.viewBtn, { borderColor: C.divider }]} onPress={onPress}>
            <Text style={[st.viewBtnText, { color: C.text2 }]}>View</Text>
          </TouchableOpacity>
          {showClaim && onClaim && (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: C.blue600 }, isClaiming && st.disabled]}
              onPress={onClaim}
              disabled={isClaiming}
            >
              <Text style={st.primaryBtnText}>{isClaiming ? 'Claiming…' : 'Claim Job'}</Text>
            </TouchableOpacity>
          )}
          {actionLabel && onAction && (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: C.blue600 }, actionLoading && st.disabled]}
              onPress={onAction}
              disabled={actionLoading}
            >
              <Text style={st.primaryBtnText}>{actionLoading ? 'Loading…' : actionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card:    { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  jobId:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  badge:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dot:     { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  price:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  infoRow: { gap: 6, marginBottom: 10 },
  infoItem:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:{ fontSize: 12, flex: 1 },
  tasksRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  taskPill:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  taskText:{ fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  viewBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  viewBtnText: { fontSize: 13, fontWeight: '600' },
  primaryBtn:  { flex: 2, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.45 },
});
