import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getJob, claimJob, updateJobStatus, uploadProofImage } from '@/app/actions/jobs';
import { useColors } from '@/lib/themeContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useAuth } from '@/lib/authContext';
import type { Job } from '@/types';

export default function EmployeeJobDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuth();
  const C = useColors();

  const [job,          setJob]          = useState<Job | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [claiming,     setClaiming]     = useState(false);
  const [showChat,     setShowChat]     = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [proofDesc,    setProofDesc]    = useState('');
  const [images,       setImages]       = useState<string[]>([]);
  const [submitting,   setSubmitting]   = useState(false);

  useEffect(() => {
    getJob(id).then(setJob).catch(console.warn).finally(() => setLoading(false));
  }, [id]);

  async function handleClaim() {
    Alert.alert('Claim Job?', 'You will be assigned and responsible for completing this job.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Claim', onPress: async () => {
        setClaiming(true);
        try {
          await claimJob(id);
          Alert.alert('Claimed! 🎉', 'Go to My Jobs to manage this job.', [
            { text: 'View My Jobs', onPress: () => router.push('/employee/myjobs' as any) },
          ]);
        } catch (err: any) { Alert.alert('Failed', err.message ?? 'Try again.'); }
        finally { setClaiming(false); }
      }},
    ]);
  }

  async function pickImage(fromCamera: boolean) {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Camera access is required.'); return; }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!res.canceled && res.assets[0]) setImages((p) => [...p, res.assets[0].uri]);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Photo library access is required.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true });
      if (!res.canceled) setImages((p) => [...p, ...res.assets.map((a) => a.uri)]);
    }
  }

  async function submitMarkDone() {
    if (!user) return;
    if (images.length === 0) { Alert.alert('Proof required', 'Please add at least one photo.'); return; }
    setSubmitting(true);
    try {
      const urls = await Promise.all(images.map((uri) => uploadProofImage(uri, user.id)));
      await updateJobStatus(id, 'PENDING_REVIEW', urls, proofDesc);
      setModalVisible(false);
      setJob(await getJob(id));
      Alert.alert('Submitted! ✅', "Job sent for customer review. You'll be paid when they approve.");
    } catch (err: any) { Alert.alert('Error', err.message ?? 'Could not submit.'); }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]}>
      <View style={st.center}><ActivityIndicator size="large" color={C.blue600} /></View>
    </SafeAreaView>
  );
  if (!job) return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]}>
      <View style={st.center}><Text style={{ color: C.text3 }}>Job not found</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider }]}>
        <TouchableOpacity style={[st.iconBtn, { backgroundColor: C.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text2} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Job Details</Text>
        <TouchableOpacity
          style={[st.iconBtn, { backgroundColor: showChat ? C.blue600 : C.blue50, borderWidth: 1, borderColor: showChat ? C.blue600 : C.blue100 }]}
          onPress={() => setShowChat(!showChat)}
        >
          <Ionicons name="chatbubble-outline" size={18} color={showChat ? '#fff' : C.blue600} />
        </TouchableOpacity>
      </View>

      {showChat ? (
        <ChatWindow jobId={id} />
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          <View style={[st.heroCard, { backgroundColor: C.blue800 }]}>
            <View style={st.heroTop}>
              <Text style={st.jobId}>#{job.id.slice(0, 8).toUpperCase()}</Text>
              <StatusBadge status={job.status} />
            </View>
            <Text style={st.price}>${(job.price_amount / 100).toFixed(2)}</Text>
            <Text style={st.priceNote}>You receive ~85% after platform fee</Text>
            <View style={st.payoutPill}>
              <Ionicons name="cash-outline" size={14} color="#fff" />
              <Text style={st.payoutText}>Est. payout: ${((job.price_amount * 0.85) / 100).toFixed(2)}</Text>
            </View>
          </View>

          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <Text style={[st.cardTitle, { color: C.text1 }]}>Job Info</Text>
            {[
              { icon: 'resize-outline'   as const, label: 'Size',     value: job.size || '—' },
              { icon: 'location-outline' as const, label: 'Location', value: job.location_address || '—' },
              { icon: 'flash-outline'    as const, label: 'Urgency',  value: job.urgency },
              { icon: 'time-outline'     as const, label: 'Posted',   value: new Date(job.created_at).toLocaleString() },
            ].map((row) => (
              <View key={row.label} style={st.detailRow}>
                <Ionicons name={row.icon} size={17} color={C.text3} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.detailLabel, { color: C.text3 }]}>{row.label.toUpperCase()}</Text>
                  <Text style={[st.detailValue, { color: C.text1 }]}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {job.tasks?.length > 0 && (
            <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Text style={[st.cardTitle, { color: C.text1 }]}>Tasks Required</Text>
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

          {job.status === 'OPEN' && (
            <TouchableOpacity
              style={[st.actionBtn, { backgroundColor: C.blue600 }, claiming && st.disabled]}
              onPress={handleClaim}
              disabled={claiming}
            >
              {claiming
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="hand-right-outline" size={20} color="#fff" /><Text style={st.actionBtnText}>Claim this Job</Text></>
              }
            </TouchableOpacity>
          )}

          {job.status === 'IN_PROGRESS' && (
            <TouchableOpacity
              style={[st.actionBtn, { backgroundColor: C.success }]}
              onPress={() => { setProofDesc(''); setImages([]); setModalVisible(true); }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={st.actionBtnText}>Mark as Done</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Mark Done Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={[st.modalSafe, { backgroundColor: C.surface }]}>
            <View style={[st.modalHeader, { borderBottomColor: C.divider }]}>
              <Text style={[st.modalTitle, { color: C.text1 }]}>Submit Proof of Work</Text>
              <TouchableOpacity style={[st.iconBtn, { backgroundColor: C.surface2 }]} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.text2} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={st.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={[st.modalDesc, { color: C.text2 }]}>
                Take or upload photos of the completed work.
              </Text>
              <Text style={[st.fieldLabel, { color: C.text2 }]}>DESCRIPTION (Optional)</Text>
              <TextInput
                style={[st.textarea, { backgroundColor: C.surface2, borderColor: C.divider, color: C.text1 }]}
                placeholder="Describe the work completed…"
                placeholderTextColor={C.text3}
                value={proofDesc}
                onChangeText={setProofDesc}
                multiline
                numberOfLines={3}
              />
              <Text style={[st.fieldLabel, { color: C.text2 }]}>PHOTOS</Text>
              <View style={st.photoButtons}>
                <TouchableOpacity style={[st.photoBtn, { backgroundColor: C.blue600 }]} onPress={() => pickImage(true)}>
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                  <Text style={st.photoBtnTextW}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.photoBtn, { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.divider }]} onPress={() => pickImage(false)}>
                  <Ionicons name="images-outline" size={20} color={C.blue600} />
                  <Text style={[st.photoBtnTextW, { color: C.blue600 }]}>From Gallery</Text>
                </TouchableOpacity>
              </View>
              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {images.map((uri, i) => (
                    <View key={i} style={{ position: 'relative', marginRight: 10 }}>
                      <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10 }} />
                      <TouchableOpacity style={{ position: 'absolute', top: -6, right: -6 }} onPress={() => setImages((p) => p.filter((_, idx) => idx !== i))}>
                        <Ionicons name="close-circle" size={20} color={C.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity
                style={[st.submitBtn, { backgroundColor: C.blue600 }, submitting && st.disabled]}
                onPress={submitMarkDone}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={st.submitBtnText}>Submit for Review</Text></>
                }
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn:{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700' },
  scroll: { padding: 16, gap: 14, paddingBottom: 36 },
  heroCard: { borderRadius: 16, padding: 20, alignItems: 'center' },
  heroTop:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  jobId:    { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },
  price:    { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 4 },
  priceNote:{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  payoutPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  payoutText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  card:   { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontSize: 13, fontWeight: '600' },
  actionBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  modalSafe:  { flex: 1 },
  modalHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalScroll:{ padding: 20, gap: 10, paddingBottom: 40 },
  modalDesc:  { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 8 },
  textarea:   { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 90, textAlignVertical: 'top', marginBottom: 16 },
  photoButtons: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  photoBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  photoBtnTextW:{ fontSize: 14, fontWeight: '700', color: '#fff' },
  submitBtn:  { borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  disabled:   { opacity: 0.5 },
});
