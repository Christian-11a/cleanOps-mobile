import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Image, Modal, BackHandler, StatusBar, Platform, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getJob, approveJobCompletion, cancelJob, approveApplication, rejectApplication } from '@/actions/jobs';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Job } from '@/types';

const { width } = Dimensions.get('window');

const STEPS = [
  { id: 'OPEN', label: 'Posted' },
  { id: 'IN_PROGRESS', label: 'Cleaning' },
  { id: 'PENDING_REVIEW', label: 'Review' },
  { id: 'COMPLETED', label: 'Done' }
];

export default function CustomerJobDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const { colors: C, isDark, statusColors: SC } = useTheme();
  const { refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [job,            setJob]           = useState<Job | null>(null);
  const [loading,        setLoading]       = useState(true);
  const [approving,      setApproving]     = useState(false);
  const [cancelling,     setCancelling]    = useState(false);
  const [rejecting,      setRejecting]     = useState(false);
  const [showChat,       setShowChat]      = useState(false);
  const [selectedImage,  setSelectedImage] = useState<string | null>(null);
  const [applicantRating, setApplicantRating] = useState<number | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [applicantProfile, setApplicantProfile] = useState<{
    full_name: string; rating: number | null; phone: string | null;
    created_at: string; jobs_completed: number;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  async function fetchJob() {
    try {
      const data = await getJob(id);
      setJob(data);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onBackPress = () => {
      if (showChat) { setShowChat(false); return true; }
      if (router.canGoBack()) router.back();
      else router.replace('/customer');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showChat]);

  useEffect(() => { fetchJob(); }, [id]);

  // Fetch applicant's real rating once we have their worker_id
  useEffect(() => {
    const workerId = (job as any)?.worker_id;
    if (!workerId || job?.status !== 'OPEN') return;
    (supabase as any)
      .from('profiles')
      .select('rating')
      .eq('id', workerId)
      .single()
      .then(({ data }: any) => {
        if (data?.rating) setApplicantRating(Number(data.rating));
      });
  }, [(job as any)?.worker_id, job?.status]);

  async function handleApproveCleaner() {
    if (!job?.employee_name) return;
    const workerId = (job as any).worker_id;
    if (!workerId) {
      Alert.alert('Cannot Approve', 'The applicant ID is missing. The cleaner may need to reapply.');
      return;
    }
    setApproving(true);
    try {
      await approveApplication(id, workerId);
      await fetchJob();
      toast.show('Cleaner approved! Job is now In Progress.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setApproving(false);
    }
  }

  async function handleApprove() {
    Alert.alert('Approve & Release Payment?', 'The cleaner will receive their payment.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setApproving(true);
        try {
          await approveJobCompletion(id);
          setJob(await getJob(id));
          await refreshProfile();
          toast.show('Payment released to the cleaner.');
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
          await cancelJob(id);
          setJob(await getJob(id));
          await refreshProfile();
        } catch (err: any) { Alert.alert('Error', err.message); }
        finally { setCancelling(false); }
      }},
    ]);
  }

  async function handleReject() {
    Alert.alert('Reject Applicant?', 'This will remove the current applicant and reopen the job for others.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        setRejecting(true);
        try {
          await rejectApplication(id);
          setApplicantRating(null);
          setApplicantProfile(null);
          setJob(await getJob(id));
          toast.show('Applicant removed. Job is open again.');
        } catch (err: any) { Alert.alert('Error', err.message); }
        finally { setRejecting(false); }
      }},
    ]);
  }

  async function handleViewProfile() {
    const workerId = (job as any)?.worker_id;
    if (!workerId) return;
    setShowProfileModal(true);
    if (applicantProfile) return; // already loaded
    setLoadingProfile(true);
    try {
      const [{ data: prof }, { count }] = await Promise.all([
        (supabase as any).from('profiles').select('full_name, rating, phone, created_at').eq('id', workerId).single(),
        (supabase as any).from('jobs').select('*', { count: 'exact', head: true }).eq('worker_id', workerId).eq('status', 'COMPLETED'),
      ]);
      setApplicantProfile({
        full_name: prof?.full_name || 'Unknown',
        rating: prof?.rating ? Number(prof.rating) : null,
        phone: prof?.phone || null,
        created_at: prof?.created_at || '',
        jobs_completed: count ?? 0,
      });
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingProfile(false);
    }
  }

  const goBack = () => {
    if (showChat) setShowChat(false);
    else if (router.canGoBack()) router.back();
    else router.replace('/customer');
  };

  if (loading) return (
    <View style={[st.container, { backgroundColor: '#f0f4f8' }]}><View style={st.center}><ActivityIndicator size="large" color={C.blue600} /></View></View>
  );
  if (!job) return (
    <View style={[st.container, { backgroundColor: '#f0f4f8' }]}><View style={st.center}><Text style={{ color: C.text3 }}>Job not found</Text></View></View>
  );

  const price = Number(job.price_amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const isUrgent = job.urgency === 'HIGH';
  const urgencyColor = isUrgent ? '#ef4444' : job.urgency === 'NORMAL' ? '#f59e0b' : '#22c55e';
  const urgencyText  = isUrgent ? '#b91c1c' : job.urgency === 'NORMAL' ? '#92400e' : '#166534';
  const urgencyLabel = isUrgent ? 'Urgent Priority' : job.urgency === 'NORMAL' ? 'Medium Priority' : 'Standard Priority';

  const currentStepIdx = STEPS.findIndex(s => s.id === job.status);
  const taskCount = job.tasks?.length || 0;
  const ratingDisplay = applicantRating !== null
    ? `${applicantRating.toFixed(1)} ⭐ • ${applicantRating >= 4.5 ? 'Excellent' : applicantRating >= 4 ? 'Great' : 'Good'}`
    : 'New Cleaner';

  return (
    <View style={[st.container, { backgroundColor: '#f0f4f8' }]}>
      <StatusBar barStyle="light-content" />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#0c4a6e', '#0284c7']}
        style={[st.headerGradient, { paddingTop: insets.top + 12 }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View style={st.headerContent}>
          <TouchableOpacity style={st.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={st.headerTextWrap}>
            <Text style={st.headerTitle} numberOfLines={1}>{job.tasks?.[0] || 'Regular Clean'}</Text>
            <View style={st.statusPill}>
               <Text style={st.statusPillText}>{SC[job.status]?.label || 'Open'}</Text>
            </View>
          </View>
          <Text style={st.headerPrice}>${price}</Text>
        </View>
      </LinearGradient>

      {showChat ? (
        <View style={st.chatContainer}>
          <ChatWindow jobId={id} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          
          {/* Job Progress */}
          <View style={st.card}>
            <Text style={st.cardTitle}>Job Progress</Text>
            <View style={st.stepperContainer}>
               {STEPS.map((step, idx) => {
                 const isCompleted = currentStepIdx >= idx;
                 return (
                   <View key={step.id} style={st.stepWrapper}>
                      <View style={st.stepNode}>
                         <View style={[st.stepCircle, isCompleted ? st.stepCircleActive : st.stepCircleInactive]}>
                            <View style={[st.stepInnerDot, isCompleted ? st.stepInnerDotActive : st.stepInnerDotInactive]} />
                         </View>
                         <Text style={[st.stepLabel, isCompleted ? st.stepLabelActive : st.stepLabelInactive]}>{step.label}</Text>
                      </View>
                      {idx < STEPS.length - 1 && (
                        <View style={st.stepLineWrapper}>
                          <View style={[st.stepLine, currentStepIdx > idx ? st.stepLineActive : st.stepLineInactive]} />
                        </View>
                      )}
                   </View>
                 )
               })}
            </View>
          </View>

          {/* Details */}
          <View style={st.card}>
            <Text style={st.cardTitle}>Details</Text>
            
            <View style={st.detailRow}>
              <Ionicons name="location-outline" size={14} color="#3f3f46" />
              <Text style={st.detailText}>{job.location_address || 'Address not set'}</Text>
            </View>
            
            <View style={st.detailRow}>
              <View style={[st.urgencyDot, { backgroundColor: urgencyColor }]} />
              <Text style={[st.urgencyText, { color: urgencyText }]}>{urgencyLabel}</Text>
            </View>

            <Text style={[st.tasksProgressLabel, { marginBottom: 8 }]}>{taskCount} task{taskCount !== 1 ? 's' : ''} requested</Text>

            {job.tasks?.map((t, i) => (
               <View key={i} style={st.taskItem}>
                 <View style={st.taskCheckbox} />
                 <Text style={st.taskText}>🧺 {t}</Text>
               </View>
            ))}
          </View>

          {/* Proof of work */}
          {job.proof_urls && job.proof_urls.length > 0 && (
            <View style={st.card}>
              <Text style={st.cardTitle}>Proof of Work</Text>
              {job.proof_description ? (
                <View style={[st.commentBox, { backgroundColor: C.surface2 }]}>
                  <Text style={[st.commentLabel, { color: C.text3 }]}>CLEANER'S COMMENT</Text>
                  <Text style={st.detailText}>{job.proof_description}</Text>
                </View>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                {job.proof_urls.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => setSelectedImage(url)}>
                    <Image source={{ uri: url }} style={st.proofImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Chat Preview / Toggle */}
          <View style={st.card}>
            <Text style={st.cardTitle}>Chat</Text>
            <Text style={st.chatEmptyText}>Click below to open chat</Text>
            <TouchableOpacity style={st.openChatBtn} onPress={() => setShowChat(true)}>
               <Text style={st.openChatBtnText}>Open Chat Window</Text>
               <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Applications Section */}
          {job.status === 'OPEN' && (
            <View style={st.card}>
              <Text style={st.cardTitle}>Interested Cleaners</Text>
              {job.employee_name ? (
                <View style={st.applicantCard}>
                  <TouchableOpacity style={st.applicantInfo} onPress={handleViewProfile} activeOpacity={0.75}>
                    <View style={st.avatarPlaceholder}>
                      <Ionicons name="person" size={20} color="#94a3b8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.applicantName}>{job.employee_name}</Text>
                      <View style={st.ratingRow}>
                        {applicantRating !== null && <Ionicons name="star" size={12} color="#fbbf24" />}
                        <Text style={st.ratingText}>{ratingDisplay}</Text>
                      </View>
                    </View>
                    <View style={st.viewProfilePill}>
                      <Text style={st.viewProfileText}>View Profile</Text>
                      <Ionicons name="chevron-forward" size={12} color="#0284c7" />
                    </View>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[st.rejectBtn, rejecting && st.disabled]}
                      onPress={handleReject}
                      disabled={rejecting || approving}
                    >
                      {rejecting ? <ActivityIndicator color="#ef4444" size="small" /> : <Text style={st.rejectBtnText}>Reject</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.approveCleanerBtn, { flex: 1 }, approving && st.disabled]}
                      onPress={handleApproveCleaner}
                      disabled={approving || rejecting}
                    >
                      <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                        {approving ? <ActivityIndicator color="#fff" /> : <Text style={st.approveCleanerText}>Approve & Hire</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={st.emptyApplicants}>
                   <ActivityIndicator size="small" color={C.blue600} />
                   <Text style={st.emptyApplicantsText}>Waiting for cleaners to apply…</Text>
                </View>
              )}
            </View>
          )}

          {/* Approve */}
          {job.status === 'PENDING_REVIEW' && (
            <View style={[st.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={[st.cardTitle, { color: '#166534' }]}>Ready for Review</Text>
              <Text style={{ fontSize: 13, color: '#15803d', marginBottom: 12 }}>Cleaner marked this job as done. Review and approve to release payment.</Text>
              <TouchableOpacity
                style={[st.approveBtn, { backgroundColor: '#16a34a' }, approving && st.disabled]}
                onPress={handleApprove}
                disabled={approving}
              >
                {approving
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={st.approveBtnText}>Approve Payment</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel */}
          {job.status === 'OPEN' && (
            <TouchableOpacity
              style={[st.cancelBtn, cancelling && st.disabled]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={st.cancelBtnText}>{cancelling ? 'Cancelling…' : 'Cancel Job'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Applicant Profile Modal */}
      <Modal visible={showProfileModal} transparent animationType="slide" onRequestClose={() => setShowProfileModal(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowProfileModal(false)}>
          <View style={[st.profileSheet, { backgroundColor: '#fff' }]} onStartShouldSetResponder={() => true}>
            <LinearGradient colors={['#0c4a6e', '#0284c7']} style={st.profileHeader}>
              <View style={st.profileAvatarLarge}>
                <Ionicons name="person" size={36} color="#94a3b8" />
              </View>
              <Text style={st.profileName}>{applicantProfile?.full_name || job?.employee_name || '—'}</Text>
              {applicantProfile?.rating !== null && applicantProfile?.rating !== undefined ? (
                <View style={st.profileRatingRow}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={st.profileRatingText}>{applicantProfile.rating.toFixed(1)} rating</Text>
                </View>
              ) : (
                <Text style={st.profileRatingText}>New Cleaner</Text>
              )}
            </LinearGradient>

            <View style={st.profileBody}>
              {loadingProfile ? (
                <ActivityIndicator color="#0284c7" style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <View style={st.profileStatRow}>
                    <View style={st.profileStat}>
                      <Ionicons name="briefcase-outline" size={20} color="#0284c7" />
                      <Text style={st.profileStatValue}>{applicantProfile?.jobs_completed ?? 0}</Text>
                      <Text style={st.profileStatLabel}>Jobs Done</Text>
                    </View>
                    <View style={[st.profileStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e2e8f0' }]}>
                      <Ionicons name="star-outline" size={20} color="#fbbf24" />
                      <Text style={st.profileStatValue}>
                        {applicantProfile?.rating !== null && applicantProfile?.rating !== undefined
                          ? applicantProfile.rating.toFixed(1) : '—'}
                      </Text>
                      <Text style={st.profileStatLabel}>Rating</Text>
                    </View>
                    <View style={st.profileStat}>
                      <Ionicons name="calendar-outline" size={20} color="#22c55e" />
                      <Text style={st.profileStatValue}>
                        {applicantProfile?.created_at
                          ? new Date(applicantProfile.created_at).getFullYear().toString()
                          : '—'}
                      </Text>
                      <Text style={st.profileStatLabel}>Member Since</Text>
                    </View>
                  </View>

                  {applicantProfile?.phone && (
                    <View style={[st.profileInfoRow, { backgroundColor: '#f8fafc' }]}>
                      <Ionicons name="call-outline" size={16} color="#64748b" />
                      <Text style={st.profileInfoText}>{applicantProfile.phone}</Text>
                    </View>
                  )}

                  <View style={[st.profileInfoRow, { backgroundColor: '#f0fdf4' }]}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#22c55e" />
                    <Text style={[st.profileInfoText, { color: '#15803d' }]}>Verified Cleaner on CleanOps</Text>
                  </View>
                </>
              )}

              <TouchableOpacity style={st.profileCloseBtn} onPress={() => setShowProfileModal(false)}>
                <Text style={st.profileCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={st.imageModalOverlay}>
          <TouchableOpacity style={st.modalCloseBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={st.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerGradient: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTextWrap: { flex: 1, alignItems: 'flex-start' },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  statusPill: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 12,
  },
  statusPillText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  headerPrice: { fontSize: 18, fontWeight: '700', color: '#fff' },

  chatContainer: { flex: 1, backgroundColor: '#f0f4f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: 16, overflow: 'hidden' },

  scroll: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8edf3',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172b', marginBottom: 12 },

  stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  stepWrapper: { flexDirection: 'row', alignItems: 'center' },
  stepNode: { alignItems: 'center', width: 44 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#0284c7' },
  stepCircleInactive: { backgroundColor: '#f1f5f9' },
  stepInnerDot: { width: 8, height: 8, borderRadius: 4 },
  stepInnerDotActive: { backgroundColor: '#fff' },
  stepInnerDotInactive: { backgroundColor: '#cbd5e1' },
  stepLabel: { fontSize: 9, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  stepLabelActive: { color: '#0284c7' },
  stepLabelInactive: { color: '#94a3b8' },
  stepLineWrapper: { width: 30, paddingHorizontal: 4, marginTop: -16 },
  stepLine: { height: 2, borderRadius: 1, width: '100%' },
  stepLineActive: { backgroundColor: '#0284c7' },
  stepLineInactive: { backgroundColor: '#e2e8f0' },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailText: { fontSize: 14, color: '#45556c' },
  urgencyDot: { width: 14, height: 14, borderRadius: 7 },
  urgencyText: { fontSize: 14, fontWeight: '600' },

  tasksProgress: { marginTop: 12, marginBottom: 16 },
  tasksProgressLabel: { fontSize: 12, fontWeight: '600', color: '#62748e', marginBottom: 8 },
  progressBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  taskCheckbox: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  taskText: { fontSize: 12, color: '#0f172a' },

  chatEmptyText: { fontSize: 12, color: '#90a1b9', textAlign: 'center', marginVertical: 12 },
  openChatBtn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  openChatBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  cancelBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1, borderColor: '#fecdd3',
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#e11d48' },
  
  approveBtn: {
    borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  commentBox: { borderRadius: 12, padding: 12, gap: 4 },
  commentLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  proofImage: { width: 80, height: 80, borderRadius: 12, marginRight: 10 },

  applicantCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  applicantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    color: '#64748b',
  },
  rejectBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  rejectBtnText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  approveCleanerBtn: {
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveCleanerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyApplicants: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyApplicantsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '100%', height: '80%' },
  disabled: { opacity: 0.5 },

  viewProfilePill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  viewProfileText: { fontSize: 11, fontWeight: '700', color: '#0284c7' },

  profileSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  profileHeader: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, gap: 8 },
  profileAvatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileRatingText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  profileBody: { padding: 20, gap: 12 },
  profileStatRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  profileStat: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  profileStatValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  profileStatLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  profileInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  profileInfoText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  profileCloseBtn: { backgroundColor: '#f1f5f9', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  profileCloseBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
});
