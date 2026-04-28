import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, PanResponder, LayoutChangeEvent, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { useColors } from '@/lib/themeContext';
import { PanGestureHandler, PanGestureHandlerGestureEvent, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '@/lib/authContext';
import { updateServiceRadius } from '@/actions/profile';

export default function ServiceAreaScreen() {
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  
  const [radius, setRadius] = useState(15);
  const [active, setLocalActive] = useState(true);
  
  const [sliderWidth, setSliderWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locStatus, setLocStatus] = useState<Location.PermissionStatus | null>(null);
  const minRadius = 1;
  const maxRadius = 50;

  useEffect(() => {
    async function init() {
      if (profile) {
        setRadius(profile.service_radius || 15);
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocStatus(status);
      setLoading(false);
    }
    init();
  }, [profile]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setSliderWidth(width);
  };

  const updateRadiusValue = (x: number) => {
    if (sliderWidth <= 0) return;
    let clampedX = Math.max(0, Math.min(x, sliderWidth));
    const ratio = clampedX / sliderWidth;
    const newRadius = Math.round(minRadius + (maxRadius - minRadius) * ratio);
    setRadius(newRadius);
  };

  const onGestureEvent = (evt: PanGestureHandlerGestureEvent) => {
    updateRadiusValue(evt.nativeEvent.x);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateServiceRadius(radius);
      await refreshProfile();
      Alert.alert('Success', 'Service preferences updated');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handlePos = sliderWidth > 0 ? ((radius - minRadius) / (maxRadius - minRadius)) * sliderWidth : 0;

  if (loading) {
    return <View style={[st.container, { backgroundColor: C.bg, justifyContent: 'center' }]}><ActivityIndicator color={C.blue600} size="large" /></View>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[st.container, { backgroundColor: C.bg }]}>
        <View style={[st.topBar, { backgroundColor: C.surface, borderBottomColor: C.divider, paddingTop: insets.top }]}>
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={C.text1} />
          </TouchableOpacity>
          <Text style={[st.topTitle, { color: C.text1 }]}>Service Area</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 40 }]}>
          <View style={[st.infoCard, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)' }]}>
             <Ionicons name="navigate-circle" size={24} color="#22c55e" />
             <Text style={[st.infoText, { color: C.text1 }]}>
               Adjust your service radius to control which jobs appear in your feed.
             </Text>
          </View>

          <Text style={[st.sectionTitle, { color: C.text1, marginTop: 32 }]}>Visibility</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: C.text1 }]}>Job Dispatching</Text>
                <Text style={[st.sub, { color: C.text3 }]}>Toggle availability for new jobs</Text>
              </View>
              <Switch 
                value={active} 
                onValueChange={setLocalActive}
                trackColor={{ false: '#cbd5e1', true: '#22c55e' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <Text style={[st.sectionTitle, { color: C.text1, marginTop: 32 }]}>Radius Settings</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider, padding: 20 }]}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={[st.label, { color: C.text1 }]}>Search Radius</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#22c55e' }}>{radius} km</Text>
             </View>
             
             <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onGestureEvent} activeOffsetX={[-10, 10]}>
                <View 
                  onLayout={onLayout} 
                  style={{ height: 60, justifyContent: 'center', backgroundColor: 'transparent' }}
                >
                   <View style={{ height: 6, backgroundColor: C.divider, borderRadius: 3, width: '100%' }}>
                      <View style={{ height: 6, backgroundColor: '#22c55e', borderRadius: 3, width: `${((radius - minRadius) / (maxRadius - minRadius)) * 100}%` }} />
                   </View>
                   <View 
                     style={{ 
                       position: 'absolute', 
                       left: handlePos - 16, 
                       width: 32, 
                       height: 32, 
                       borderRadius: 16, 
                       backgroundColor: '#fff', 
                       borderWidth: 2, 
                       borderColor: '#22c55e', 
                       elevation: 3, 
                       shadowColor: '#000', 
                       shadowOffset: { width: 0, height: 2 }, 
                       shadowOpacity: 0.2, 
                       shadowRadius: 3,
                       zIndex: 10,
                     }} 
                   />
                </View>
             </PanGestureHandler>
             
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ fontSize: 12, color: C.text3 }}>{minRadius} km</Text>
                <Text style={{ fontSize: 12, color: C.text3 }}>{maxRadius} km</Text>
             </View>
          </View>

          <Text style={[st.sectionTitle, { color: C.text1, marginTop: 32 }]}>Device Permissions</Text>
          <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
             <View style={[st.row, { paddingVertical: 20 }]}>
                <View style={[st.iconWrap, { backgroundColor: locStatus === 'granted' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                   <Ionicons 
                      name={locStatus === 'granted' ? "shield-checkmark" : "alert-circle"} 
                      size={24} 
                      color={locStatus === 'granted' ? "#22c55e" : "#ef4444"} 
                   />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={[st.label, { color: C.text1 }]}>Location Access</Text>
                   <Text style={[st.sub, { color: C.text3 }]}>
                      Status: <Text style={{ fontWeight: '700', color: locStatus === 'granted' ? '#22c55e' : '#ef4444' }}>
                        {locStatus === 'granted' ? 'Enabled' : (locStatus === 'denied' ? 'Denied' : 'Not Set')}
                      </Text>
                   </Text>
                </View>
                <TouchableOpacity 
                   style={[st.settingsBtn, { backgroundColor: C.surface2 }]}
                   onPress={() => Linking.openSettings()}
                >
                   <Text style={[st.settingsBtnText, { color: C.text2 }]}>Settings</Text>
                </TouchableOpacity>
             </View>
             {locStatus !== 'granted' && (
               <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 12, borderTopWidth: 1, borderTopColor: C.divider }}>
                  <Text style={{ fontSize: 11, color: '#ef4444', lineHeight: 16 }}>
                    GPS is required to calculate distances to jobs. If you denied access, please tap the button above to enable it in your phone settings.
                  </Text>
               </View>
             )}
          </View>

          <TouchableOpacity style={[st.saveBtn, { backgroundColor: '#22c55e' }]} onPress={handleSave} disabled={saving}>
             {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Save Preferences</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </GestureHandlerRootView>


  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20 },
  infoCard: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, alignItems: 'center' },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  label: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingsBtn: { paddingHorizontal: 16, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingsBtnText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

