// Mobile equivalent of components/dashboard/RecentActivityFeed.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/themeContext';
import { SkeletonBox } from '@/components/shared/SkeletonLoader';
import type { Job } from '@/types';

interface Props {
  jobs: Job[];
  role?: 'customer' | 'employee';
  loading?: boolean;
}

export function RecentActivityFeed({ jobs, role = 'customer', loading = false }: Props) {
  const router = useRouter();
  const { colors: C, statusColors: SC } = useTheme();

  function goToJob(id: string) {
    const base = role === 'employee' ? '/employee/jobs' : '/customer/jobs';
    router.push(`${base}/${id}` as any);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.row, { backgroundColor: C.surface, borderColor: C.divider, opacity: 0.6 }]}>
            <SkeletonBox width={40} height={40} borderRadius={12} />
            <View style={styles.rowInfo}>
              <View style={styles.rowTop}>
                <SkeletonBox width={80} height={14} />
                <SkeletonBox width={60} height={12} />
              </View>
              <SkeletonBox width={150} height={12} style={{ marginTop: 4 }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="document-text-outline" size={32} color={C.text3} />
        <Text style={[styles.emptyText, { color: C.text3 }]}>No recent activity yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {jobs.slice(0, 5).map((job) => {
        const s = SC[job.status] ?? SC['OPEN'];
        
        // Contextual description
        let desc = 'Job created and awaiting assignment';
        let icon: keyof typeof Ionicons.glyphMap = 'sparkles';
        let iconColor = C.blue600;

        if (job.status === 'IN_PROGRESS') {
          desc = job.employee_name ? `${job.employee_name} is cleaning your space` : 'Cleaning in progress';
          icon = 'time' as const;
          iconColor = C.warning;
        } else if (job.status === 'PENDING_REVIEW') {
          desc = 'Job completed! Please review and approve';
          icon = 'eye' as const;
          iconColor = '#db2777';
        } else if (job.status === 'COMPLETED') {
          desc = 'Service finalized and payment released';
          icon = 'checkmark-circle' as const;
          iconColor = C.success;
        } else if (job.status === 'CANCELLED') {
          desc = 'Job was cancelled';
          icon = 'close-circle' as const;
          iconColor = C.error;
        }

        return (
          <TouchableOpacity 
            key={job.id} 
            style={[styles.row, { backgroundColor: C.surface, borderColor: C.divider }]} 
            onPress={() => goToJob(job.id)} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: `${iconColor}15` }]}>
              <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            
            <View style={styles.rowInfo}>
              <View style={styles.rowTop}>
                <Text style={[styles.rowId, { color: C.text1 }]}>#{job.id.slice(0, 6).toUpperCase()}</Text>
                <Text style={[styles.rowTime, { color: C.text3 }]}>{new Date(job.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.rowDesc, { color: C.text3 }]} numberOfLines={1}>{desc}</Text>
            </View>
            
            <Ionicons name="chevron-forward" size={16} color={C.text3} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo:   { flex: 1, gap: 2 },
  rowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowId:     { fontSize: 13, fontWeight: '700' },
  rowTime:   { fontSize: 11 },
  rowDesc:   { fontSize: 12, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '500' },
});
