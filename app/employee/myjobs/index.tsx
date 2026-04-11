import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getEmployeeJobs, updateJobStatus, uploadProofImage } from '@/app/actions/jobs';
import { useColors } from '@/lib/themeContext';
import { JobCard } from '@/components/shared/JobCard';
import type { Job } from '@/types';
import { useAuth } from '@/lib/authContext';

export default function EmployeeMyJobsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const insets = useSafeAreaInsets();

  const [jobs,         setJobs]         = useState<Job[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedJob,  setSelectedJob]  = useState<Job | null>(null);
  const [proofDesc,    setProofDesc]    = useState('');
  const [images,       setImages]       = useState<string[]>([]);
  const [submitting,   setSubmitting]   = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const all = await getEmployeeJobs();
      setJobs(all.filter((j) => j.status === 'IN_PROGRESS' || j.status === 'PENDING_REVIEW'));
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  function openModal(job: Job) {
    setSelectedJob(job);
    setProofDesc('');
    setImages([]);
    setModalVisible(true);
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
    if (!selectedJob || !user) return;
    if (images.length === 0) { Alert.alert('Proof required', 'Please add at least one photo.'); return; }

    setSubmitting(true);
    try {
      const urls = await Promise.all(images.map((uri) => uploadProofImage(uri, user.id)));
      await updateJobStatus(selectedJob.id, 'PENDING_REVIEW', urls, proofDesc);
      setModalVisible(false);
      Alert.alert('Submitted! ✅', 'Job sent for customer review.');
      fetchJobs();
    } catch (err: any) { Alert.alert('Error', err.message ?? 'Could not submit.'); }
    finally { setSubmitting(false); }
  }

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.bg }]} edges={['top', 'left', 'right']}>
      <View style={[st.header, { borderBottomColor: C.divider }]}>
        <TouchableOpacity style={[st.backBtn, { backgroundColor: C.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text2} />
        </TouchableOpacity>
        <View>
          <Text style={[st.title, { color: C.text1 }]}>My Jobs</Text>
          <Text style={[st.sub, { color: C.text3 }]}>In progress & pending review</Text>
        </View>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={C.blue600} /></View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={C.blue600} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="briefcase-outline" size={48} color={C.text3} />
              <Text style={[st.emptyTitle, { color: C.text1 }]}>No active jobs</Text>
              <Text style={[st.emptyDesc, { color: C.text3 }]}>Claimed jobs appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View>
              <JobCard job={item} onPress={() => router.push(`/employee/jobs/${item.id}`)} />
              {item.status === 'IN_PROGRESS' && (
                <TouchableOpacity style={[st.markDoneBtn, { backgroundColor: C.success }]} onPress={() => openModal(item)}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={st.markDoneBtnText}>Mark as Done</Text>
                </TouchableOpacity>
              )}
              {item.status === 'PENDING_REVIEW' && (
                <View style={[st.pendingBanner, { backgroundColor: C.surface2, borderColor: C.divider }]}>
                  <Ionicons name="hourglass-outline" size={16} color={C.warning} />
                  <Text style={[st.pendingText, { color: C.text2 }]}>Awaiting customer review</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Mark Done Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={[st.modalSafe, { backgroundColor: C.surface }]}>
            <View style={[st.modalHeader, { borderBottomColor: C.divider }]}>
              <Text style={[st.modalTitle, { color: C.text1 }]}>Submit Proof of Work</Text>
              <TouchableOpacity style={[st.modalClose, { backgroundColor: C.surface2 }]} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.text2} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={st.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={[st.modalDesc, { color: C.text2 }]}>
                Take or upload photos of the completed work. The customer will review before releasing your payment.
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
                  <Text style={st.photoBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.photoBtn, { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.divider }]} onPress={() => pickImage(false)}>
                  <Ionicons name="images-outline" size={20} color={C.blue600} />
                  <Text style={[st.photoBtnText, { color: C.blue600 }]}>From Gallery</Text>
                </TouchableOpacity>
              </View>

              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.thumbRow}>
                  {images.map((uri, i) => (
                    <View key={i} style={st.thumbWrap}>
                      <Image source={{ uri }} style={st.thumb} />
                      <TouchableOpacity style={st.thumbRemove} onPress={() => setImages((p) => p.filter((_, idx) => idx !== i))}>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title:  { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub:    { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  empty:  { alignItems: 'center', paddingTop: 64, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyDesc:  { fontSize: 14 },
  markDoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, marginTop: -8, marginBottom: 12 },
  markDoneBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginTop: -8, marginBottom: 12, borderWidth: 1 },
  pendingText: { fontSize: 13, fontWeight: '600' },
  modalSafe:   { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle:  { fontSize: 18, fontWeight: '800' },
  modalClose:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { padding: 20, gap: 10, paddingBottom: 40 },
  modalDesc:   { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  fieldLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 8 },
  textarea:    { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 90, textAlignVertical: 'top', marginBottom: 16 },
  photoButtons:{ flexDirection: 'row', gap: 10, marginBottom: 14 },
  photoBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  photoBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
  thumbRow:    { marginBottom: 16 },
  thumbWrap:   { position: 'relative', marginRight: 10 },
  thumb:       { width: 80, height: 80, borderRadius: 10 },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  submitBtn:   { borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  disabled:    { opacity: 0.5 },
});
