import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image, Dimensions, Platform,
  StatusBar, TextInput, Modal, BackHandler, Share, Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getJob, applyForJob, updateJobStatus, uploadProofImage, hasEmployeeAppliedToJob } from '@/actions/jobs';
import { useTheme } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatTimeAgo, calculateDistance } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';
import { ChatWindow } from '@/components/chat/ChatWindow';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import type { Job } from '@/types';

const { width } = Dimensions.get('window');

export default function EmployeeJobDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { colors: C, isDark } = useTheme();
  const { user, profile: authProfile } = useAuth();
  const toast = useToast();

  const [job,         setJob]         = useState<Job | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [applying,    setApplying]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [showChat,    setShowChat]    = useState(false);
  const [hasApplied,  setHasApplied]  = useState(false);
  const [userLoc,     setUserLoc]     = useState<{lat: number, lng: number} | null>(null);
  
  // Checklist State
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  
  // Submission State
  const [proofDesc, setProofDesc] = useState('');
  const [images,    setImages]    = useState<string[]>([]);

  // Permissions
  const [cameraStatus,  requestCameraPermission]  = ImagePicker.useCameraPermissions();
  const [libraryStatus, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();

  useEffect(() => {
    const onBackPress = () => {
      if (showChat) { setShowChat(false); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showChat]);

  const fetchJob = async () => {
    try {
      // 1. Fetch only essential data (Job info + specific applied check)
      const [data, alreadyApplied] = await Promise.all([
        getJob(id),
        hasEmployeeAppliedToJob(id)
      ]);

      setJob(data);
      setHasApplied(alreadyApplied);

      if (data.status === 'PENDING_REVIEW' || data.status === 'COMPLETED') {
         const all = new Set(data.tasks.map((_, i) => i));
         setCompletedTasks(all);
      }

      // 2. STOP LOADING SPINNER IMMEDIATELY
      setLoading(false);

      // 3. FETCH GPS IN BACKGROUND (NON-BLOCKING)
      Location.getForegroundPermissionsAsync().then(async (perm) => {
        if (perm.status === 'granted') {
          try {
            // Try last known first (instant)
            let loc = await Location.getLastKnownPositionAsync();
            
            // If null or stale, fetch new one with balanced accuracy (faster than high)
            if (!loc) {
              loc = await Location.getCurrentPositionAsync({ 
                accuracy: Location.Accuracy.Balanced 
              });
            }

            if (loc) {
              setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
          } catch(e) { if (__DEV__) console.warn('Background GPS failed:', e); }
        }
      });

    } catch (e) {
      if (__DEV__) console.warn(e);
      setLoading(false);
    }
  };

  useEffect(() => { fetchJob(); }, [id]);

  const theme = useMemo(() => {
    if (!job) return null;
    if (job.urgency === 'HIGH') return { primary: '#ef4444', bg: ['#450a0a', '#7f1d1d', '#991b1b'], icon: 'alert-circle', label: 'URGENT', emoji: '🚨' };
    if (job.urgency === 'NORMAL') return { primary: '#f59e0b', bg: ['#451a03', '#78350f', '#92400e'], icon: 'flash', label: 'MEDIUM', emoji: '⚡' };
    return { primary: '#22c55e', bg: ['#064e3b', '#065f46', '#047857'], icon: 'sparkles', label: 'STANDARD', emoji: '✨' };
  }, [job]);

  const toggleTask = (index: number) => {
    if (job?.status !== 'IN_PROGRESS') return;
    const next = new Set(completedTasks);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setCompletedTasks(next);
  };

  const pickImage = async () => {
    if (libraryStatus?.status !== ImagePicker.PermissionStatus.GRANTED) {
      const permission = await requestLibraryPermission();
      if (!permission.granted) return Alert.alert('Error', 'Library access required');
    }
    const res = await ImagePicker.launchImageLibraryAsync({ 
      quality: 0.7, 
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled) setImages(prev => [...prev, ...res.assets.map(a => a.uri)]);
  };

  const takePhoto = async () => {
    if (cameraStatus?.status !== ImagePicker.PermissionStatus.GRANTED) {
      const permission = await requestCameraPermission();
      if (!permission.granted) return Alert.alert('Error', 'Camera access required');
    }
    const res = await ImagePicker.launchCameraAsync({ 
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled) setImages(prev => [...prev, ...res.assets.map(a => a.uri)]);
  };

  const handleNavigate = async () => {
    const { location_lat: lat, location_lng: lng, location_address: addr } = job || {};
    const label = `${job?.size || 'Home'} Cleaning`;
    

    let url = '';
    if (lat && lng) {
      url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${label})`
      }) || '';
    } else if (addr) {
      // Fallback to address search if no coordinates
      const encodedAddr = encodeURIComponent(addr);
      url = Platform.select({
        ios: `maps:0,0?q=${encodedAddr}`,
        android: `geo:0,0?q=${encodedAddr}`
      }) || '';
    }

    if (url) {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const webUrl = (lat && lng) 
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || '')}`;
        await Linking.openURL(webUrl);
      }
    } else {
      Alert.alert('Error', 'No address or coordinates available for this job.');
    }
  };

  async function handleApply() {
    if (!job) return;
    Alert.alert('Apply for Task?', 'Are you sure you want to apply for this task?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Apply', onPress: async () => {
        setApplying(true);
        try {
          await applyForJob(job.id);
          setHasApplied(true);
          toast.show('Application sent!');
        } catch (err: any) {
          Alert.alert('Application Failed', err.message || 'Please try again.');
        } finally {
          setApplying(false);
        }
      }},
    ]);
  }

  async function handleFinalSubmit() {
    if (!job || !user) return;
    if (images.length === 0) return Alert.alert('Proof Required', 'Please add at least one photo of the finished work.');
    
    setSubmitting(true);
    try {
      const urls = await Promise.all(images.map(uri => uploadProofImage(uri, user.id)));
      await updateJobStatus(job.id, 'PENDING_REVIEW', urls, proofDesc);
      toast.show('Job submitted! Waiting for customer approval.');
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  }

  if (loading || !job || !theme) return (
    <View style={[st.safe, { backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={C.blue600} />
    </View>
  );

  // Determine employee's relationship to this job
  const isJobOpen     = job.status === 'OPEN';
  const isMeAssigned  = job.employee_id === user?.id;
  // Also detect applied state by matching profile name against worker_name on the job
  const isMeApplicant = isJobOpen && !!job.employee_name && job.employee_name === authProfile?.full_name;
  const isApplied     = isJobOpen && (hasApplied || isMeAssigned || isMeApplicant);
  const isAvailable   = isJobOpen && !isApplied && !job.employee_id;
  const isInProgress  = job.status === 'IN_PROGRESS';
  const isPendingReview = job.status === 'PENDING_REVIEW';
  const isCompleted   = job.status === 'COMPLETED';
  const estPayout     = (job.price_amount * 0.9);

  if (showChat) {
    return (
      <View style={[st.safe, { backgroundColor: C.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={['#0c4a6e', '#0284c7']}
          style={[st.chatHeader, { paddingTop: insets.top + 12 }]}
        >
          <View style={st.headerContentHorizontal}>
            <TouchableOpacity style={st.backBtnSmall} onPress={() => setShowChat(false)}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={st.headerTextWrap}>
              <Text style={st.chatHeaderTitle}>Chat with Customer</Text>
              <Text style={st.chatHeaderSub}>{job.size || 'Home'} Cleaning</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={st.chatFullWrapper}>
          <ChatWindow jobId={id} />
        </View>
      </View>
    );
  }

  return (
    <View style={[st.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <LinearGradient colors={theme.bg as any} style={[st.header, { paddingTop: insets.top + 10 }]}>
          <View style={st.topNav}>
            <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={st.urgencyBadge}>
               <Ionicons name={theme.icon as any} size={14} color="#fff" />
               <Text style={st.urgencyText}>{theme.label}</Text>
            </View>
            <TouchableOpacity style={st.shareBtn} onPress={() => Alert.alert('Download Task Info', 'The task summary and address are being generated as a PDF...')}>
              <Ionicons name="download-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={st.headerContent}>
             <Text style={st.jobEmoji}>{theme.emoji}</Text>
             <Text style={st.jobTitle}>{job.size || 'Home'} Cleaning</Text>
             <View style={st.priceRow}>
                <Text style={st.priceLabel}>Total Pay</Text>
                <Text style={st.priceValue}>${job.price_amount.toFixed(0)}</Text>
             </View>
             <View style={st.payoutPill}>
                <Text style={st.payoutText}>Your Earning (90%): <Text style={st.payoutBold}>${estPayout.toFixed(2)}</Text></Text>
             </View>
          </View>
        </LinearGradient>

        <View style={st.content}>
           {/* Dynamic Status Banner */}
           {isApplied && (
             <View style={[st.statusBanner, { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' }]}>
                <Ionicons name="time" size={18} color="#0369a1" />
                <Text style={[st.statusBannerText, { color: '#0369a1' }]}>Application Pending Approval</Text>
             </View>
           )}

           {/* Checklist Card */}
           <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <View style={st.cardHeader}>
                 <Ionicons name="checkbox" size={18} color={theme.primary} />
                 <Text style={[st.cardTitle, { color: C.text1 }]}>Task Checklist</Text>
                 <Text style={[st.taskCount, { color: C.text3 }]}>{completedTasks.size}/{job.tasks.length}</Text>
              </View>
              <View style={st.taskList}>
                 {job.tasks.map((task, i) => {
                   const isDone = completedTasks.has(i);
                   return (
                     <TouchableOpacity 
                       key={i} 
                       style={st.taskItem} 
                       onPress={() => toggleTask(i)}
                       activeOpacity={isInProgress ? 0.7 : 1}
                     >
                        <View style={[st.checkCircle, { borderColor: isDone ? theme.primary : C.divider, backgroundColor: isDone ? theme.primary : 'transparent' }]}>
                           {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={[st.taskText, { color: isDone ? C.text3 : C.text1, textDecorationLine: isDone ? 'line-through' : 'none' }]}>{task}</Text>
                     </TouchableOpacity>
                   );
                 })}
              </View>
           </View>

           {/* Chat Section (Only if Active/Review) */}
           {(isInProgress || isPendingReview) && (
             <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
                <Text style={[st.cardTitle, { color: C.text1 }]}>Chat</Text>
                <Text style={[st.chatEmptyText, { color: C.text3 }]}>Click below to open chat</Text>
                <TouchableOpacity style={[st.openChatBtn, { backgroundColor: C.blue600 }]} onPress={() => setShowChat(true)}>
                   <Text style={st.openChatBtnText}>Open Chat Window</Text>
                   <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
                </TouchableOpacity>
             </View>
           )}

           {/* Location Card */}
           <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <View style={st.cardHeader}><Ionicons name="location" size={18} color={theme.primary} /><Text style={[st.cardTitle, { color: C.text1 }]}>Location</Text></View>
              <Text style={[st.addressText, { color: C.text2 }]}>{job.location_address}</Text>
              <View style={[st.mapPlaceholder, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                 <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.1)']} style={st.mapOverlay}>
                    <Ionicons name="navigate" size={32} color={theme.primary} />
                    <Text style={[st.mapText, { color: C.text3 }]}>
                      {userLoc && job.location_lat && job.location_lng 
                        ? `${calculateDistance(userLoc.lat, userLoc.lng, job.location_lat, job.location_lng).toFixed(1)} km away`
                        : (job.location_lat ? `${job.distance?.toFixed(1)} km away` : 'Location pinned')}
                    </Text>
                    
                    {(job.location_lat || job.location_address) && (
                      <TouchableOpacity 
                        style={[st.navigateBtn, { backgroundColor: theme.primary }]}
                        onPress={handleNavigate}
                      >
                         <Ionicons name="map" size={14} color="#fff" />
                         <Text style={st.navigateBtnText}>Navigate to Job</Text>
                      </TouchableOpacity>
                    )}
                 </LinearGradient>
              </View>
           </View>

           {/* Proof Upload (Only if In Progress) */}
           {isInProgress && completedTasks.size === job.tasks.length && (
             <View style={[st.card, { backgroundColor: C.surface, borderColor: C.blue600 }]}>
                <Text style={[st.cardTitle, { color: C.text1, marginBottom: 8 }]}>Submit Completion</Text>
                <Text style={[st.subText, { color: C.text3, marginBottom: 16 }]}>Upload proof of your work to finish the job.</Text>
                
                <View style={st.imageGrid}>
                   {images.map((uri, idx) => (
                     <View key={idx} style={st.imageWrap}>
                        <Image source={{ uri }} style={st.imagePreview} />
                        <TouchableOpacity style={st.removeImg} onPress={() => setImages(prev => prev.filter((_, i) => i !== idx))}>
                           <Ionicons name="close-circle" size={20} color={C.error} />
                        </TouchableOpacity>
                     </View>
                   ))}
                   <TouchableOpacity style={[st.uploadBtn, { backgroundColor: C.surface2, borderColor: C.divider }]} onPress={takePhoto}>
                      <Ionicons name="camera" size={24} color={C.blue600} />
                      <Text style={[st.uploadText, { color: C.blue600 }]}>Take Photo</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[st.uploadBtn, { backgroundColor: C.surface2, borderColor: C.divider }]} onPress={pickImage}>
                      <Ionicons name="image" size={24} color={C.blue600} />
                      <Text style={[st.uploadText, { color: C.blue600 }]}>Gallery</Text>
                   </TouchableOpacity>
                </View>
             </View>
           )}
        </View>
      </ScrollView>

      {/* Action Footer */}
      <View style={[st.footer, { backgroundColor: C.surface, borderTopColor: C.divider, paddingBottom: Math.max(insets.bottom, 16) }]}>
         {isAvailable ? (
            <TouchableOpacity style={[st.applyBtn, { backgroundColor: '#111827' }]} onPress={handleApply} disabled={applying}>
              {applying ? <ActivityIndicator color="#fff" /> : <><Text style={st.applyBtnText}>Apply for this Task</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
            </TouchableOpacity>
         ) : isApplied ? (
            <View style={[st.appliedBtn, { backgroundColor: C.surface2, borderColor: C.divider }]}>
               <Ionicons name="time" size={20} color={C.blue600} />
               <Text style={[st.appliedText, { color: C.text1 }]}>Awaiting Approval</Text>
            </View>
         ) : isInProgress ? (
            <TouchableOpacity 
              style={[st.applyBtn, { backgroundColor: completedTasks.size === job.tasks.length ? C.success : '#94a3b8' }]} 
              onPress={handleFinalSubmit}
              disabled={submitting || completedTasks.size !== job.tasks.length}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={st.applyBtnText}>Submit for Review</Text>}
            </TouchableOpacity>
         ) : isPendingReview ? (
            <View style={[st.appliedBtn, { backgroundColor: C.surface2, borderColor: C.divider }]}>
               <Ionicons name="eye" size={20} color="#f59e0b" />
               <Text style={[st.appliedText, { color: C.text1 }]}>Under Review</Text>
            </View>
         ) : isCompleted ? (
            <View style={[st.appliedBtn, { backgroundColor: C.surface2, borderColor: C.divider }]}>
               <Ionicons name="checkmark-circle" size={20} color={C.success} />
               <Text style={[st.appliedText, { color: C.text1 }]}>Job Completed</Text>
            </View>
         ) : (
            <View style={[st.appliedBtn, { backgroundColor: C.surface2, borderColor: C.divider }]}>
               <Ionicons name="alert-circle" size={20} color={C.text3} />
               <Text style={[st.appliedText, { color: C.text1 }]}>Status Unavailable</Text>
            </View>
         )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  urgencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  urgencyText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  shareBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  
  headerContent: { alignItems: 'center' },
  jobEmoji: { fontSize: 48, marginBottom: 8 },
  jobTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 20 },
  priceRow: { alignItems: 'center', gap: 4 },
  priceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase' },
  priceValue: { fontSize: 48, fontWeight: '900', color: '#fff' },
  payoutPill: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 12 },
  payoutText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  payoutBold: { fontWeight: '800', color: '#fff' },

  content: { padding: 16, gap: 16 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  statusBannerText: { fontSize: 14, fontWeight: '700' },

  card: { borderRadius: 24, padding: 16, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  taskCount: { fontSize: 12, marginLeft: 'auto', fontWeight: '700' },
  
  taskList: { gap: 12 },
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  taskText: { fontSize: 14, fontWeight: '500' },

  chatEmptyText: { fontSize: 12, color: '#90a1b9', textAlign: 'center', marginVertical: 12 },
  openChatBtn: {
    borderRadius: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  openChatBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  chatHeader: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 16 },
  headerContentHorizontal: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 },
  backBtnSmall: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1 },
  chatHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  chatHeaderSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  chatFullWrapper: { flex: 1, marginTop: 12 },

  addressText: { fontSize: 14, fontWeight: '500' },
  mapPlaceholder: { height: 120, borderRadius: 16, overflow: 'hidden' },
  mapOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapText: { fontSize: 12, fontWeight: '600' },
  navigateBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
    marginTop: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  navigateBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  subText: { fontSize: 13, lineHeight: 18 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageWrap: { position: 'relative' },
  imagePreview: { width: 80, height: 80, borderRadius: 12 },
  removeImg: { position: 'absolute', top: -5, right: -5 },
  uploadBtn: { width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  uploadText: { fontSize: 10, fontWeight: '700' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  applyBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  applyBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  appliedBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#e2e8f0' },
  appliedText: { fontSize: 16, fontWeight: '700' },
});
