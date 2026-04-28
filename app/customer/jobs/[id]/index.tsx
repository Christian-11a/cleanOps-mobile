import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Image, Modal, BackHandler, StatusBar, Platform, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getJob, approveJobCompletion, cancelJob, approveApplication, rejectApplication, getJobApplicants, uploadProofImage } from '@/actions/jobs';
import { submitReview, getJobReview, getProfileReviews } from '@/actions/reviews';
import { submitDispute, getJobDispute } from '@/actions/disputes';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import { ChatWindow } from '@/components/chat/ChatWindow';
import * as ImagePicker from 'expo-image-picker';
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
  const { refreshProfile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [job,            setJob]           = useState<Job | null>(null);
  const [applicants,     setApplicants]    = useState<any[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [approving,      setApproving]     = useState(false);
  const [cancelling,     setCancelling]    = useState(false);
  const [rejecting,      setRejecting]     = useState(false);
  const [showChat,       setShowChat]      = useState(false);
  const [selectedImage,  setSelectedImage] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [applicantProfile, setApplicantProfile] = useState<{
    id: string; full_name: string; rating: number | null; phone: string | null;
    created_at: string; jobs_completed: number;
  } | null>(null);
  const [applicantReviews, setApplicantReviews] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Ratings & Disputes State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Poor Service Quality');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeImages, setDisputeImages] = useState<string[]>([]);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [hasDisputed, setHasDisputed] = useState(false);

  async function handlePickDisputeMedia() {
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled) setDisputeImages(prev => [...prev, ...res.assets.map(a => a.uri)]);
  }

  async function handleTakeDisputePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Error', 'Camera access required');
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) setDisputeImages(prev => [...prev, ...res.assets.map(a => a.uri)]);
  }

  async function fetchJob() {
    try {
      const [jobData, applicantsData] = await Promise.all([
        getJob(id),
        getJobApplicants(id)
      ]);
      setJob(jobData);
      setApplicants(applicantsData || []);
      if (jobData?.status === 'COMPLETED') {
        const [review, dispute] = await Promise.all([
          getJobReview(id),
          getJobDispute(id),
        ]);
        setHasReviewed(!!review);
        setHasDisputed(!!dispute);
      }
    } catch (err) {
      if (__DEV__) console.warn(err);
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
  }, [showChat, router]);

  useFocusEffect(useCallback(() => {
    fetchJob();
  }, [id]));

  async function handleApproveCleaner(applicant: any) {
    const workerId = applicant.employee_id;
    const workerName = applicant.profiles?.full_name;
    if (!workerId || !workerName) return;

    Alert.alert('Approve Cleaner?', `Are you sure you want to hire ${workerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve & Hire', onPress: async () => {
        setApproving(true);
        try {
          await approveApplication(id, workerId);
          await fetchJob();
          toast.show(`Cleaner approved! ${workerName} is now on the way.`);
        } catch (err: any) {
          Alert.alert('Error', err.message);
        } finally {
          setApproving(false);
        }
      }},
    ]);
  }

  async function handleApprove() {
    Alert.alert('Approve & Release Payment?', 'The cleaner will receive their payment.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setApproving(true);
        try {
          await approveJobCompletion(id);
          const data = await getJob(id);
          setJob(data);
          await refreshProfile();
          toast.show('Payment released to the cleaner.');
        } catch (err: any) { Alert.alert('Error', err.message); }
        finally { setApproving(false); }
      }},
    ]);
  }

  async function handleCancel() {
    Alert.alert('Cancel Booking?', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        setCancelling(true);
        try {
          await cancelJob(id);
          const data = await getJob(id);
          setJob(data);
          await refreshProfile();
        } catch (err: any) { Alert.alert('Error', err.message); }
        finally { setCancelling(false); }
      }},
    ]);
  }

  async function handleReject(applicant: any) {
    const workerName = applicant.profiles?.full_name || 'this applicant';
    Alert.alert('Reject Applicant?', `Are you sure you want to reject ${workerName}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        setRejecting(true);
        try {
          await rejectApplication(applicant.id);
          await fetchJob();
          toast.show('Applicant removed.');
        } catch (err: any) { Alert.alert('Error', err.message); }
        finally { setRejecting(false); }
      }},
    ]);
  }

  async function handleViewProfile(applicant: any) {
    const workerId = applicant.employee_id;
    if (!workerId) return;
    
    setApplicantProfile(null);
    setShowProfileModal(true);
    setLoadingProfile(true);
    
    try {
      const [{ data: prof }, reviews] = await Promise.all([
        (supabase as any).from('profiles').select('full_name, rating, phone, created_at, total_jobs').eq('id', workerId).single(),
        getProfileReviews(workerId)
      ]);
      setApplicantProfile({
        id: workerId,
        full_name: prof?.full_name || 'Unknown',
        rating: prof?.rating ? Number(prof.rating) : null,
        phone: prof?.phone || null,
        created_at: prof?.created_at || '',
        jobs_completed: prof?.total_jobs ?? 0,
      });
      setApplicantReviews(reviews);
    } catch (e) {
      if (__DEV__) console.warn(e);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleRatingSubmit() {
    if (!job?.employee_id) return;
    if (ratingVal === 0) {
      Alert.alert('Select a Rating', 'Please tap a star to rate your cleaner before submitting.');
      return;
    }
    setSubmittingRating(true);
    try {
      await submitReview(id, job.employee_id, ratingVal, ratingComment.trim() || undefined);
      setHasReviewed(true);
      await refreshProfile();
      toast.show('Thank you for your feedback!');
      setShowRatingModal(false);
      setRatingVal(0);
      setRatingComment('');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        Alert.alert('Already Rated', 'You have already submitted a rating for this job.');
        setHasReviewed(true);
        setShowRatingModal(false);
      } else {
        Alert.alert('Error', msg || 'Failed to submit rating.');
      }
    } finally {
      setSubmittingRating(false);
    }
  }

  async function handleDisputeSubmit() {
    if (!job?.employee_id || !user) return;
    const desc = disputeDesc.trim();
    if (!desc || desc.length < 10) {
      Alert.alert('Details Required', 'Please describe the issue in at least 10 characters before submitting.');
      return;
    }
    setSubmittingDispute(true);
    try {
      let urls: string[] = [];
      if (disputeImages.length > 0) {
        urls = await Promise.all(disputeImages.map(uri => uploadProofImage(uri, user.id)));
      }
      await submitDispute(id, job.employee_id, disputeReason, desc, urls);
      setHasDisputed(true);
      toast.show('Issue reported. Our team will review it.');
      setShowDisputeModal(false);
      setDisputeImages([]);
      setDisputeDesc('');
      setDisputeReason('Poor Service Quality');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        Alert.alert('Already Reported', 'You have already filed a report for this job.');
        setHasDisputed(true);
        setShowDisputeModal(false);
      } else {
        Alert.alert('Error', msg || 'Failed to submit report.');
      }
    } finally {
      setSubmittingDispute(false);
    }
  }

  const goBack = () => {
    if (showChat) setShowChat(false);
    else if (router.canGoBack()) router.back();
    else router.replace('/customer');
  };

  if (loading) return (
    <View style={[st.container, { backgroundColor: C.bg }]}><View style={st.center}><ActivityIndicator size="large" color={C.blue600} /></View></View>
  );
  if (!job) return (
    <View style={[st.container, { backgroundColor: C.bg }]}><View style={st.center}><Text style={{ color: C.text3 }}>Job not found</Text></View></View>
  );

  const price = Number(job.price_amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const isUrgent = job.urgency === 'HIGH';
  const urgencyColor = isUrgent ? '#ef4444' : job.urgency === 'NORMAL' ? '#f59e0b' : '#22c55e';
  const urgencyText  = isUrgent ? (isDark ? '#fecaca' : '#b91c1c') : job.urgency === 'NORMAL' ? (isDark ? '#fef3c7' : '#92400e') : (isDark ? '#dcfce7' : '#166534');
  const urgencyLabel = isUrgent ? 'Urgent Priority' : job.urgency === 'NORMAL' ? 'Medium Priority' : 'Standard Priority';

  const currentStepIdx = STEPS.findIndex(s => s.id === job.status);
  const taskCount = job.tasks?.length || 0;

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
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
            <View style={[st.statusPill, { backgroundColor: SC[job.status]?.bg || '#dbeafe' }]}>
               <Text style={[st.statusPillText, { color: SC[job.status]?.text || '#1d4ed8' }]}>{SC[job.status]?.label || 'Open'}</Text>
            </View>
          </View>
          <Text style={st.headerPrice}>${price}</Text>
        </View>
      </LinearGradient>

      {showChat ? (
        <View style={[st.chatContainer, { backgroundColor: C.bg }]}>
          <ChatWindow jobId={id} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          
          {/* Job Progress */}
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <Text style={[st.cardTitle, { color: C.text1 }]}>Job Progress</Text>
            <View style={st.stepperContainer}>
               {STEPS.map((step, idx) => {
                 const isCompleted = currentStepIdx >= idx;
                 return (
                   <View key={step.id} style={st.stepWrapper}>
                      <View style={st.stepNode}>
                         <View style={[st.stepCircle, isCompleted ? st.stepCircleActive : { backgroundColor: C.surface2 }]}>
                            <View style={[st.stepInnerDot, isCompleted ? st.stepInnerDotActive : { backgroundColor: C.text3 + '40' }]} />
                         </View>
                         <Text style={[st.stepLabel, isCompleted ? st.stepLabelActive : { color: C.text3 }]}>{step.label}</Text>
                      </View>
                      {idx < STEPS.length - 1 && (
                        <View style={st.stepLineWrapper}>
                          <View style={[st.stepLine, currentStepIdx > idx ? st.stepLineActive : { backgroundColor: C.divider }]} />
                        </View>
                      )}
                   </View>
                 )
               })}
            </View>
          </View>

          {/* Details */}
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <Text style={[st.cardTitle, { color: C.text1 }]}>Details</Text>
            
            <View style={st.detailRow}>
              <Ionicons name="location-outline" size={14} color={C.text2} />
              <Text style={[st.detailText, { color: C.text2 }]}>{job.location_address || 'Address not set'}</Text>
            </View>
            
            <View style={st.detailRow}>
              <View style={[st.urgencyDot, { backgroundColor: urgencyColor }]} />
              <Text style={[st.urgencyText, { color: urgencyText }]}>{urgencyLabel}</Text>
            </View>

            <Text style={[st.tasksProgressLabel, { color: C.text3, marginBottom: 8 }]}>{taskCount} task{taskCount !== 1 ? 's' : ''} requested</Text>

            {job.tasks?.map((t, i) => (
               <View key={i} style={st.taskItem}>
                 <View style={[st.taskCheckbox, { borderColor: C.divider, backgroundColor: C.surface2 }]} />
                 <Text style={[st.taskText, { color: C.text1 }]}>🧺 {t}</Text>
               </View>
            ))}
          </View>

          {/* Proof of work */}
          {job.proof_urls && job.proof_urls.length > 0 && (
            <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Text style={[st.cardTitle, { color: C.text1 }]}>Proof of Work</Text>
              {job.proof_description ? (
                <View style={[st.commentBox, { backgroundColor: C.surface2 }]}>
                  <Text style={[st.commentLabel, { color: C.text3 }]}>CLEANER'S COMMENT</Text>
                  <Text style={[st.detailText, { color: C.text2 }]}>{job.proof_description}</Text>
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
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <Text style={[st.cardTitle, { color: C.text1 }]}>Chat</Text>
            <Text style={[st.chatEmptyText, { color: C.text3 }]}>Click below to open chat</Text>
            <TouchableOpacity style={[st.openChatBtn, { backgroundColor: C.blue600 }]} onPress={() => setShowChat(true)}>
               <Text style={st.openChatBtnText}>Open Chat Window</Text>
               <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Applications Section */}
          {job.status === 'OPEN' && (
            <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Text style={[st.cardTitle, { color: C.text1 }]}>Interested Cleaners ({applicants.length})</Text>
              
              {applicants.length > 0 ? (
                applicants.map((applicant) => {
                  const rating = applicant.profiles?.rating;
                  const ratingDisplay = rating 
                    ? `${Number(rating).toFixed(1)} ⭐` 
                    : 'New Cleaner';

                  return (
                    <View key={applicant.id} style={[st.applicantCard, { backgroundColor: C.surface2, borderColor: C.divider, marginBottom: 12 }]}>
                      <TouchableOpacity 
                        style={st.applicantInfo} 
                        onPress={() => handleViewProfile(applicant)} 
                        activeOpacity={0.75}
                      >
                        <View style={[st.avatarPlaceholder, { backgroundColor: isDark ? C.bg : '#f1f5f9' }]}>
                          <Ionicons name="person" size={20} color={C.text3} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[st.applicantName, { color: C.text1 }]}>{applicant.profiles?.full_name || 'Anonymous'}</Text>
                          <View style={st.ratingRow}>
                            <Ionicons name="star" size={12} color="#fbbf24" />
                            <Text style={[st.ratingText, { color: C.text3 }]}>{ratingDisplay}</Text>
                          </View>
                        </View>
                        <View style={[st.viewProfilePill, { backgroundColor: isDark ? C.blue800 + '40' : '#e0f2fe' }]}>
                          <Text style={[st.viewProfileText, { color: isDark ? C.blue400 : '#0284c7' }]}>View Profile</Text>
                          <Ionicons name="chevron-forward" size={12} color={isDark ? C.blue400 : '#0284c7'} />
                        </View>
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        <TouchableOpacity
                          style={[st.rejectBtn, { backgroundColor: isDark ? C.error + '15' : '#fff1f2', borderColor: isDark ? C.error + '40' : '#fca5a5' }, rejecting && st.disabled]}
                          onPress={() => handleReject(applicant)}
                          disabled={rejecting || approving}
                        >
                          {rejecting ? <ActivityIndicator color={C.error} size="small" /> : <Text style={[st.rejectBtnText, { color: C.error }]}>Reject</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[st.approveCleanerBtn, approving && st.disabled]}
                          onPress={() => handleApproveCleaner(applicant)}
                          disabled={approving || rejecting}
                        >
                          <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btnGradient}>
                            {approving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.approveCleanerText}>Approve & Hire</Text>}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={st.emptyApplicants}>
                   <ActivityIndicator size="small" color={C.blue600} />
                   <Text style={[st.emptyApplicantsText, { color: C.text3 }]}>Waiting for cleaners to apply…</Text>
                </View>
              )}
            </View>
          )}

          {/* Assigned Cleaner (when IN_PROGRESS or later) */}
          {job.status !== 'OPEN' && job.employee_id && (
            <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Text style={[st.cardTitle, { color: C.text1 }]}>Your Cleaner</Text>
              <View style={[st.applicantCard, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                 <TouchableOpacity
                    style={st.applicantInfo}
                    onPress={() => handleViewProfile({ employee_id: job.employee_id })}
                    activeOpacity={0.75}
                  >
                    <View style={[st.avatarPlaceholder, { backgroundColor: isDark ? C.bg : '#f1f5f9' }]}>
                      <Ionicons name="person" size={20} color={C.text3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.applicantName, { color: C.text1 }]}>{job.employee_name || 'Assigned Cleaner'}</Text>
                      <Text style={[st.ratingText, { color: C.text3 }]}>Assigned Cleaner</Text>
                    </View>
                    <View style={[st.viewProfilePill, { backgroundColor: isDark ? C.blue800 + '40' : '#e0f2fe' }]}>
                      <Text style={[st.viewProfileText, { color: isDark ? C.blue400 : '#0284c7' }]}>View Profile</Text>
                    </View>
                 </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Approve */}
          {job.status === 'PENDING_REVIEW' && (
            <View style={[st.card, { backgroundColor: isDark ? C.success + '15' : '#f0fdf4', borderColor: isDark ? C.success + '40' : '#bbf7d0' }]}>
              <Text style={[st.cardTitle, { color: isDark ? C.success : '#166534' }]}>Ready for Review</Text>
              <Text style={{ fontSize: 13, color: isDark ? C.text2 : '#15803d', marginBottom: 12 }}>Cleaner marked this job as done. Review and approve to release payment.</Text>
              <TouchableOpacity
                style={[st.approveBtn, { backgroundColor: C.success }, approving && st.disabled]}
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

          {/* Completed Actions */}
          {job.status === 'COMPLETED' && (
            <View style={st.completedActionsRow}>
              <TouchableOpacity
                style={[st.actionBtn, { backgroundColor: hasReviewed ? C.surface2 : C.surface, borderColor: hasReviewed ? C.divider : C.blue600 }]}
                onPress={() => {
                  if (hasReviewed) { Alert.alert('Already Rated', 'You have already submitted a rating for this job.'); return; }
                  setRatingVal(0); setRatingComment(''); setShowRatingModal(true);
                }}
              >
                 <Ionicons name={hasReviewed ? 'star' : 'star-outline'} size={18} color={hasReviewed ? '#fbbf24' : C.blue600} />
                 <Text style={[st.actionBtnText, { color: hasReviewed ? C.text3 : C.blue600 }]}>{hasReviewed ? 'Rated' : 'Rate Cleaner'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.actionBtn, { backgroundColor: hasDisputed ? C.surface2 : C.surface, borderColor: hasDisputed ? C.divider : C.error }]}
                onPress={() => {
                  if (hasDisputed) { Alert.alert('Already Reported', 'You have already filed a report for this job.'); return; }
                  setShowDisputeModal(true);
                }}
              >
                 <Ionicons name="warning-outline" size={18} color={hasDisputed ? C.text3 : C.error} />
                 <Text style={[st.actionBtnText, { color: hasDisputed ? C.text3 : C.error }]}>{hasDisputed ? 'Reported' : 'Report Issue'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel */}
          {job.status === 'OPEN' && (
            <TouchableOpacity
              style={[st.cancelBtn, { backgroundColor: isDark ? C.error + '15' : '#fff1f2', borderColor: isDark ? C.error + '40' : '#fecdd3' }, cancelling && st.disabled]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={[st.cancelBtnText, { color: C.error }]}>{cancelling ? 'Cancelling…' : 'Cancel Job'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Applicant Profile Modal */}
      <Modal visible={showProfileModal} transparent animationType="slide" onRequestClose={() => setShowProfileModal(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowProfileModal(false)}>
          <View style={[st.profileSheet, { backgroundColor: C.surface }]} onStartShouldSetResponder={() => true}>
            <LinearGradient colors={['#0c4a6e', '#0284c7']} style={st.profileHeader}>
              <View style={[st.profileAvatarLarge, { backgroundColor: isDark ? C.bg : '#f1f5f9' }]}>
                <Ionicons name="person" size={36} color={C.text3} />
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
                <ActivityIndicator color={C.blue600} style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <View style={[st.profileStatRow, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                    <View style={st.profileStat}>
                      <Ionicons name="briefcase-outline" size={20} color={C.blue600} />
                      <Text style={[st.profileStatValue, { color: C.text1 }]}>{applicantProfile?.jobs_completed ?? 0}</Text>
                      <Text style={[st.profileStatLabel, { color: C.text3 }]}>Jobs Completed</Text>
                    </View>
                    <View style={[st.profileStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.divider }]}>
                      <Ionicons name="star-outline" size={20} color="#fbbf24" />
                      <Text style={[st.profileStatValue, { color: C.text1 }]}>
                        {applicantProfile?.rating !== null && applicantProfile?.rating !== undefined
                          ? applicantProfile.rating.toFixed(1) : '—'}
                      </Text>
                      <Text style={[st.profileStatLabel, { color: C.text3 }]}>Rating</Text>
                    </View>
                    <View style={st.profileStat}>
                      <Ionicons name="calendar-outline" size={20} color={C.success} />
                      <Text style={[st.profileStatValue, { color: C.text1 }]}>
                        {applicantProfile?.created_at
                          ? new Date(applicantProfile.created_at).getFullYear().toString()
                          : '—'}
                      </Text>
                      <Text style={[st.profileStatLabel, { color: C.text3 }]}>Member Since</Text>
                    </View>
                  </View>

                  {/* Reviews Section */}
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text1 }}>Recent Reviews</Text>
                      {applicantReviews.length > 3 && (
                        <TouchableOpacity onPress={() => {
                          setShowProfileModal(false);
                          router.push({
                            pathname: '/customer/profile/reviews',
                            params: { 
                              employeeId: applicantProfile?.id,
                              employeeName: applicantProfile?.full_name || job?.employee_name
                            }
                          });
                        }}>
                          <Text style={{ fontSize: 12, color: C.blue600, fontWeight: '600' }}>See All</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {applicantReviews.length > 0 ? (
                      applicantReviews.slice(0, 3).map((rev) => (
                        <View key={rev.id} style={{ marginBottom: 16, borderBottomWidth: 1, borderBottomColor: C.divider, paddingBottom: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text1 }}>{rev.reviewer?.full_name || 'Customer'}</Text>
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                              {[1,2,3,4,5].map(s => (
                                <Ionicons key={s} name="star" size={10} color={rev.rating >= s ? '#fbbf24' : C.divider} />
                              ))}
                            </View>
                          </View>
                          {rev.comment && <Text style={{ fontSize: 13, color: C.text2, fontStyle: 'italic' }}>"{rev.comment}"</Text>}
                          <Text style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>
                            {new Date(rev.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 13, color: C.text3, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>No reviews yet</Text>
                    )}
                  </View>

                  {applicantProfile?.phone && (
                    <View style={[st.profileInfoRow, { backgroundColor: C.surface2 }]}>
                      <Ionicons name="call-outline" size={16} color={C.text3} />
                      <Text style={[st.profileInfoText, { color: C.text2 }]}>{applicantProfile.phone}</Text>
                    </View>
                  )}

                  <View style={[st.profileInfoRow, { backgroundColor: isDark ? C.success + '15' : '#f0fdf4' }]}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={C.success} />
                    <Text style={[st.profileInfoText, { color: isDark ? C.success : '#15803d' }]}>Verified Cleaner on CleanOps</Text>
                  </View>
                </>
              )}

              <TouchableOpacity style={[st.profileCloseBtn, { backgroundColor: C.surface2 }]} onPress={() => setShowProfileModal(false)}>
                <Text style={[st.profileCloseBtnText, { color: C.text2 }]}>Close</Text>
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

      {/* Rating Modal */}
      <Modal visible={showRatingModal} transparent animationType="slide" onRequestClose={() => { setShowRatingModal(false); setRatingVal(0); setRatingComment(''); }}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => { setShowRatingModal(false); setRatingVal(0); setRatingComment(''); }}>
          <View style={[st.profileSheet, { backgroundColor: C.surface, maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text1, marginBottom: 12 }}>Rate Your Cleaner</Text>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
                {[1,2,3,4,5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setRatingVal(star)}>
                    <Ionicons name={ratingVal >= star ? 'star' : 'star-outline'} size={32} color="#fbbf24" />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[st.commentInput, { backgroundColor: C.surface2, borderColor: C.divider, color: C.text1 }]}
                placeholder="Leave a comment (optional)..."
                placeholderTextColor={C.text3}
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
              />
              <TouchableOpacity style={[st.approveCleanerBtn, { height: 50, marginTop: 12, backgroundColor: C.blue600, width: '100%', alignItems: 'center', justifyContent: 'center' }, submittingRating && st.disabled]} onPress={handleRatingSubmit} disabled={submittingRating}>
                 {submittingRating ? <ActivityIndicator color="#fff" /> : <Text style={st.approveCleanerText}>Submit Rating</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={showDisputeModal} transparent animationType="slide" onRequestClose={() => { setShowDisputeModal(false); setDisputeDesc(''); setDisputeImages([]); }}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => { setShowDisputeModal(false); setDisputeDesc(''); setDisputeImages([]); }}>
          <View style={[st.profileSheet, { backgroundColor: C.surface, maxHeight: '85%' }]} onStartShouldSetResponder={() => true}>
            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text1, marginBottom: 12 }}>Report an Issue</Text>
              <Text style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>Our team will review your report and take appropriate action.</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.text3, marginBottom: 8 }}>REASON</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['Poor Service Quality', 'Unprofessional Behavior', 'Damaged Property', 'Other'].map(r => (
                  <TouchableOpacity key={r} onPress={() => setDisputeReason(r)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: disputeReason === r ? C.blue600 : C.divider, backgroundColor: disputeReason === r ? C.blue600 + '15' : C.surface2 }}>
                    <Text style={{ fontSize: 13, color: disputeReason === r ? C.blue600 : C.text2 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.text3, marginBottom: 8 }}>DETAILS</Text>
              <TextInput
                style={[st.commentInput, { backgroundColor: C.surface2, borderColor: C.divider, color: C.text1 }]}
                placeholder="Please describe the issue..."
                placeholderTextColor={C.text3}
                value={disputeDesc}
                onChangeText={setDisputeDesc}
                multiline
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: C.text3, marginBottom: 8 }}>OPTIONAL EVIDENCE</Text>
              <View style={st.evidenceRow}>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {disputeImages.map((uri, idx) => (
                      <View key={idx} style={st.evidenceThumb}>
                         <Image source={{ uri }} style={{ flex: 1, borderRadius: 10 }} />
                         <TouchableOpacity style={st.removeThumb} onPress={() => setDisputeImages(prev => prev.filter((_, i) => i !== idx))}>
                            <Ionicons name="close-circle" size={18} color={C.error} />
                         </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={[st.uploadBtnSmall, { backgroundColor: C.surface2, borderColor: C.divider }]} onPress={handleTakeDisputePhoto}>
                       <Ionicons name="camera" size={20} color={C.blue600} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.uploadBtnSmall, { backgroundColor: C.surface2, borderColor: C.divider }]} onPress={handlePickDisputeMedia}>
                       <Ionicons name="image" size={20} color={C.blue600} />
                    </TouchableOpacity>
                 </ScrollView>
              </View>

              <TouchableOpacity style={[st.approveCleanerBtn, { height: 50, marginTop: 12, backgroundColor: C.error, width: '100%', alignItems: 'center', justifyContent: 'center' }, submittingDispute && st.disabled]} onPress={handleDisputeSubmit} disabled={submittingDispute}>
                 {submittingDispute ? <ActivityIndicator color="#fff" /> : <Text style={st.approveCleanerText}>Submit Report</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
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
    flex: 1,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
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
  completedActionsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 16, borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  commentInput: { height: 100, borderRadius: 16, borderWidth: 1, padding: 12, textAlignVertical: 'top', marginBottom: 12 },
  evidenceRow: { height: 60, marginBottom: 20 },
  evidenceThumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  removeThumb: { position: 'absolute', top: -4, right: -4, backgroundColor: '#fff', borderRadius: 10 },
  uploadBtnSmall: { width: 56, height: 56, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
