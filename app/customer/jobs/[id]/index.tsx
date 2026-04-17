// Mobile equivalent of app/customer/jobs/[id]/page.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Image, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getJob, approveJobCompletion, updateJobStatus } from '@/app/actions/jobs';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Job } from '@/types';

export default function CustomerJobDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const { colors: C, isDark } = useTheme();
  const { refreshProfile } = useAuth();
  const [job,       setJob]       = useState<Job | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [approving, setApproving] = useState(false);
  const [cancelling,setCancelling]= useState(false);
  const [showChat,  setShowChat]  = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    getJob(id).then(setJob).catch(console.warn).finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    Alert.alert('Approve & Release Payment?', 'The cleaner will receive their payment.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setApproving(true);
        try {
          await approveJobCompletion(id);
          setJob(await getJob(id));
          await refreshProfile();
          Alert.alert('Approved!', 'Payment released to the cleaner ✅');
        } catch (err: any) { Alert.alert('Error', err.message); }
        finally { setApproving(false); }
      }},
    ]);
  }

  async function handleCancel() {
    Alert.alert('Cancel Request?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: async () => {
        setCancelling(true);
        try {
          await updateJobStatus(id, 'CANCELLED');
          setJob(await getJob(id));
          await refreshProfile();
        } catch (err: any) { Alert.alert('Error', err.message); }
        finally { setCancelling(false); }
      }},
    ]);
  }

  if (loading) return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]}><View style={st.center}><ActivityIndicator size="large" color={C.blue600} /></View></SafeAreaView>
  );
  if (!job) return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]}><View style={st.center}><Text style={{ color: C.text3 }}>Job not found</Text></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]}>
      {/* Top bar */}
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider }]}>
        <TouchableOpacity style={[st.backBtn, { backgroundColor: C.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text2} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Job Details</Text>
        <TouchableOpacity
          style={[st.chatToggleBtn, showChat && st.chatToggleBtnActive, { backgroundColor: showChat ? C.blue600 : C.blue50, borderColor: showChat ? C.blue600 : C.blue100 }]}
          onPress={() => setShowChat(!showChat)}
        >
          <Ionicons name="chatbubble-outline" size={18} color={showChat ? '#fff' : C.blue600} />
        </TouchableOpacity>
      </View>

      {showChat ? (
        <ChatWindow jobId={id} />
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {/* Price hero */}
          <View style={[st.heroCard, { backgroundColor: C.blue700 }]}>
            <View style={st.heroTop}>
              <Text style={st.jobId}>#{job.id.slice(0, 8).toUpperCase()}</Text>
              <StatusBadge status={job.status} />
            </View>
            <Text style={st.price}>${(job.price_amount / 100).toFixed(2)}</Text>
            <Text style={st.priceNote}>held in escrow</Text>
          </View>

          {/* Details */}
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <Text style={[st.cardTitle, { color: C.text1 }]}>Job Info</Text>
            {[
              { icon: 'person-outline' as const,    label: 'Cleaner',  value: job.employee_name, show: job.status !== 'OPEN' },
              { icon: 'call-outline' as const,      label: 'Cleaner Phone', value: job.employee_phone, show: !!job.employee_phone },
              { icon: 'resize-outline' as const,    label: 'Size',     value: job.size || '—', show: true },
              { icon: 'location-outline' as const,  label: 'Location', value: job.location_address || '—', show: true },
              { icon: 'flash-outline' as const,     label: 'Urgency',  value: job.urgency, show: true },
              { icon: 'time-outline' as const,      label: 'Created',  value: new Date(job.created_at).toLocaleString(), show: true },
            ].filter(r => r.show).map((row) => (
              <View key={row.label} style={st.detailRow}>
                <Ionicons name={row.icon} size={17} color={C.text3} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.detailLabel, { color: C.text3 }]}>{row.label.toUpperCase()}</Text>
                  <Text style={[st.detailValue, { color: C.text1 }]}>{row.value || 'Waiting for cleaner...'}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Tasks */}
          {job.tasks?.length > 0 && (
            <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Text style={[st.cardTitle, { color: C.text1 }]}>Tasks Requested</Text>
              <View style={st.tagsWrap}>
                {job.tasks.map((t) => (
                  <View key={t} style={[st.tag, { backgroundColor: C.blue50 }]}>
                    <Ionicons name="checkmark-outline" size={13} color={C.blue600} />
                    <Text style={[st.tagText, { color: C.blue700 }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Custom Instructions */}
          {job.custom_instructions && (
            <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <View style={st.cardHeaderRow}>
                <Ionicons name="create-outline" size={18} color={C.blue600} />
                <Text style={[st.cardTitle, { color: C.text1 }]}>Your Instructions</Text>
              </View>
              <Text style={[st.proofDesc, { color: C.text1 }]}>{job.custom_instructions}</Text>
            </View>
          )}

          {/* Proof of work */}
          {job.proof_urls && job.proof_urls.length > 0 && (
            <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <View style={st.cardHeaderRow}>
                <Ionicons name="camera-outline" size={18} color={C.blue600} />
                <Text style={[st.cardTitle, { color: C.text1 }]}>Proof of Work</Text>
              </View>

              {job.proof_description ? (
                <View style={[st.commentBox, { backgroundColor: C.surface2 }]}>
                  <Text style={[st.commentLabel, { color: C.text3 }]}>CLEANER'S COMMENT</Text>
                  <Text style={[st.proofDesc, { color: C.text1 }]}>{job.proof_description}</Text>
                </View>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.proofScroll}>
                {job.proof_urls.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => setSelectedImage(url)}>
                    <Image source={{ uri: url }} style={st.proofImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Approve */}
          {job.status === 'PENDING_REVIEW' && (
            <View style={[st.reviewCard, { backgroundColor: isDark ? '#3b2a0a' : '#FFFBEB', borderColor: isDark ? '#fbbf24' : '#FDE68A' }]}>
              <Text style={[st.reviewTitle, { color: isDark ? '#fbbf24' : '#92400E' }]}>Cleaner marked this job as done</Text>
              <Text style={[st.reviewDesc, { color: isDark ? '#fef3c7' : '#78350F' }]}>Review the proof of work above, then approve to release payment.</Text>
              <TouchableOpacity
                style={[st.approveBtn, { backgroundColor: C.success }, approving && st.disabled]}
                onPress={handleApprove}
                disabled={approving}
              >
                {approving
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={st.approveBtnText}>Approve & Release Payment</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel */}
          {job.status === 'OPEN' && (
            <TouchableOpacity
              style={[st.cancelBtn, { borderColor: C.error, backgroundColor: isDark ? '#3b0f0f' : '#FEF2F2' }, cancelling && st.disabled]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={[st.cancelBtnText, { color: C.error }]}>{cancelling ? 'Cancelling…' : 'Cancel Request'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <TouchableOpacity style={st.modalCloseBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={st.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:  { flex: 1 },
  center:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: 16, fontWeight: '700' },
  chatToggleBtn: {
    width: 38, height: 38, borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  chatToggleBtnActive: { },

  scroll: { padding: 16, gap: 14, paddingBottom: 36 },

  heroCard: {
    borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  jobId:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },
  price:   { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  priceNote:{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  card: {
    borderRadius: 16, padding: 16,
    borderWidth: 1, gap: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  tagText: { fontSize: 13, fontWeight: '600' },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentBox: { borderRadius: 12, padding: 12, gap: 4 },
  commentLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  proofDesc: { fontSize: 14, lineHeight: 20 },
  proofScroll: { marginTop: 4 },
  proofImage: { width: 100, height: 100, borderRadius: 12, marginRight: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '100%', height: '80%' },

  reviewCard: {
    borderRadius: 16, padding: 16,
    borderWidth: 1, gap: 10,
  },
  reviewTitle: { fontSize: 15, fontWeight: '800' },
  reviewDesc:  { fontSize: 13, lineHeight: 18 },
  approveBtn: {
    borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  approveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  cancelBtn: {
    borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

