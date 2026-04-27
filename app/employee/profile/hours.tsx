import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/themeContext';
import { getAvailability, updateAvailability } from '@/actions/profile';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AvailabilityScreen() {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  
  const [schedule, setSchedule] = useState<Record<string, boolean>>(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: true }), {})
  );

  const [shift, setShift] = useState({ start: '08:00 AM', end: '05:00 PM' });
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [tempShift, setTempShift] = useState(shift);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAvailability().then(data => {
      if (data) {
        setSchedule(data.schedule);
        setShift({ start: data.shift_start, end: data.shift_end });
      }
      setLoading(false);
    });
  }, []);

  const toggleDay = (day: string) => {
    setSchedule(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const handleSaveShift = () => {
    setShift(tempShift);
    setEditModalVisible(false);
  };

  const handleFullSave = async () => {
    setSaving(true);
    try {
      await updateAvailability({
        schedule,
        shift_start: shift.start,
        shift_end: shift.end,
      });
      Alert.alert('Success', 'Availability updated successfully');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[st.container, { backgroundColor: C.bg, justifyContent: 'center' }]}><ActivityIndicator color={C.blue600} size="large" /></View>;
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, paddingTop: insets.top }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text1} />
        </TouchableOpacity>
        <Text style={[st.topTitle, { color: C.text1 }]}>Availability</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={[st.sectionTitle, { color: C.text1 }]}>Weekly Schedule</Text>
        <Text style={[st.sectionSub, { color: C.text3 }]}>Select the days you are available to accept cleaning jobs.</Text>
        
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
          {DAYS.map((day, idx) => (
            <View key={day} style={[st.row, idx > 0 && { borderTopWidth: 1, borderTopColor: C.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: C.text1 }]}>{day}</Text>
              </View>
              <Switch 
                value={schedule[day]} 
                onValueChange={() => {
                  setSchedule(prev => ({ ...prev, [day]: !prev[day] }));
                }}
                trackColor={{ false: '#cbd5e1', true: '#22c55e' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <Text style={[st.sectionTitle, { color: C.text1, marginTop: 32 }]}>Working Hours</Text>
        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider, padding: 16 }]}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                 <Text style={[st.label, { color: C.text1 }]}>Default Shift</Text>
                 <Text style={[st.sub, { color: C.text3 }]}>{shift.start} - {shift.end}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setTempShift(shift);
                setEditModalVisible(true);
              }}>
                 <Text style={{ color: C.blue600, fontWeight: '700' }}>Edit</Text>
              </TouchableOpacity>
           </View>
        </View>

        <TouchableOpacity 
          style={[st.saveBtn, { backgroundColor: '#22c55e' }]} 
          onPress={handleFullSave}
          disabled={saving}
        >
           {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Save Schedule</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: C.surface }]}>
            <Text style={[st.modalTitle, { color: C.text1 }]}>Edit Default Shift</Text>
            
            <View style={st.inputGroup}>
              <Text style={[st.inputLabel, { color: C.text2 }]}>Start Time</Text>
              <TextInput
                style={[st.input, { color: C.text1, borderColor: C.divider }]}
                value={tempShift.start}
                onChangeText={(text) => setTempShift({ ...tempShift, start: text })}
                placeholder="e.g. 08:00 AM"
                placeholderTextColor={C.text3}
              />
            </View>

            <View style={st.inputGroup}>
              <Text style={[st.inputLabel, { color: C.text2 }]}>End Time</Text>
              <TextInput
                style={[st.input, { color: C.text1, borderColor: C.divider }]}
                value={tempShift.end}
                onChangeText={(text) => setTempShift({ ...tempShift, end: text })}
                placeholder="e.g. 05:00 PM"
                placeholderTextColor={C.text3}
              />
            </View>

            <View style={st.modalActions}>
              <TouchableOpacity 
                style={[st.modalBtn, { backgroundColor: C.surface2 }]} 
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[st.modalBtnText, { color: C.text1 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[st.modalBtn, { backgroundColor: '#22c55e' }]} 
                onPress={handleSaveShift}
              >
                <Text style={[st.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionSub: { fontSize: 12, marginBottom: 16, lineHeight: 18 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  label: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  saveBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});

