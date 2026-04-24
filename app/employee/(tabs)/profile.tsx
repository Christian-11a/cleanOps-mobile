import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { useToast } from '@/lib/toastContext';
import { updateProfile } from '@/actions/profile';
import { signOut } from '@/actions/auth';

export default function EmployeeProfileScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const { colors: C, isDark, colorMode, setColorMode } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  
  const initials = useMemo(() => {
    return profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'E';
  }, [profile]);

  const stats = {
    jobsDone: profile?.total_jobs || 0,
    rating: profile?.rating || 0,
    earned: (profile?.money_balance || 0)
  };

  const MENU_ITEMS = [
    { id: 'edit',      label: 'Edit Profile',    sub: 'Update info & photo',   icon: 'person-outline',    route: '/employee/profile/edit' },
    { id: 'area',      label: 'Service Area',    sub: 'Update GPS radius',      icon: 'map-outline',       route: '/employee/profile/area' },
    { id: 'payout',    label: 'Payout Settings', sub: 'Bank & payout info',     icon: 'card-outline',      route: '/employee/profile/payments' },
    { id: 'security',  label: 'Privacy & Security', sub: 'Password and data',    icon: 'lock-closed-outline', route: '/employee/profile/security' },
    { id: 'alerts',    label: 'Alert Settings',  sub: 'Job dispatch alerts',   icon: 'notifications-outline', route: '/employee/profile/alerts' },
    { id: 'hours',     label: 'Availability',    sub: 'Set your active hours', icon: 'time-outline',      route: '/employee/profile/hours' },
    { id: 'support',   label: 'Help & Support',  sub: 'FAQs and contact',      icon: 'help-circle-outline', route: '/employee/profile/support' },
  ];

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/login');
      }},
    ]);
  }

  return (
    <View style={[st.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={[st.header, { paddingTop: insets.top + 20 }]}>
          <View style={st.headerTop}>
            <View style={[st.avatar, { backgroundColor: '#1e293b' }]}>
               <Text style={st.avatarText}>{initials}</Text>
            </View>
            <View style={st.headerInfo}>
               <Text style={[st.name, { color: C.text1 }]}>{profile?.full_name || 'Cleaner Name'}</Text>
               <View style={st.roleBadge}>
                  <View style={st.roleDot} />
                  <Text style={[st.roleText, { color: C.text3 }]}>Cleaner</Text>
               </View>
            </View>
            <TouchableOpacity 
              style={[st.editBtn, { backgroundColor: C.surface2 }]}
              onPress={() => router.push('/employee/profile/settings')}
            >
               <Ionicons name="settings-outline" size={20} color={C.text2} />
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View style={[st.statsBar, { backgroundColor: C.surface, borderColor: C.divider }]}>
             <View style={st.statItem}>
                <Text style={[st.statVal, { color: C.text1 }]}>{stats.jobsDone}</Text>
                <Text style={[st.statLabel, { color: C.text3 }]}>Jobs Done</Text>
             </View>
             <View style={[st.statDivider, { backgroundColor: C.divider }]} />
             <View style={st.statItem}>
                <View style={st.ratingRow}>
                   <Text style={[st.statVal, { color: C.text1 }]}>{stats.rating > 0 ? stats.rating.toFixed(1) : 'New'}</Text>
                   <Ionicons 
                     name={stats.rating > 0 ? "star" : "flash-outline"} 
                     size={12} 
                     color={stats.rating > 0 ? "#fbbf24" : C.text3} 
                     style={{ marginLeft: 2 }} 
                   />
                </View>
                <Text style={[st.statLabel, { color: C.text3 }]}>Avg Rating</Text>
             </View>
             <View style={[st.statDivider, { backgroundColor: C.divider }]} />
             <View style={st.statItem}>
                <Text style={[st.statVal, { color: C.text1 }]}>
                  {stats.earned >= 1000 
                    ? `$${(stats.earned / 1000).toFixed(1)}k` 
                    : `$${stats.earned.toFixed(0)}`}
                </Text>
                <Text style={[st.statLabel, { color: C.text3 }]}>Earned</Text>
             </View>
          </View>
        </View>

        <View style={st.content}>
           {/* Account Info Card */}
           <View style={[st.card, { backgroundColor: C.surface, borderColor: C.divider }]}>
              <Text style={[st.cardTitle, { color: C.text1 }]}>Account Info</Text>
              <View style={st.infoList}>
                 <View style={st.infoRow}>
                    <Text style={[st.infoLabel, { color: C.text3 }]}>Email</Text>
                    <Text style={[st.infoVal, { color: C.text1 }]}>{profile?.email || 'N/A'}</Text>
                 </View>
                 <View style={st.infoRow}>
                    <Text style={[st.infoLabel, { color: C.text3 }]}>Phone</Text>
                    <Text style={[st.infoVal, { color: C.text1 }]}>{profile?.phone || 'N/A'}</Text>
                 </View>
                 <View style={st.infoRow}>
                    <Text style={[st.infoLabel, { color: C.text3 }]}>Service Radius</Text>
                    <Text style={[st.infoVal, { color: C.text1 }]}>
                      {profile?.service_radius ? `${profile.service_radius} km` : 'Not set'}
                    </Text>
                 </View>
                 <View style={st.infoRow}>
                    <Text style={[st.infoLabel, { color: C.text3 }]}>Member Since</Text>
                    <Text style={[st.infoVal, { color: C.text1 }]}>
                      {profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : 'N/A'}
                    </Text>
                 </View>
              </View>
           </View>

           {/* Settings List */}
           <View style={[st.menuCard, { backgroundColor: C.surface, borderColor: C.divider }]}>
              {MENU_ITEMS.map((item, idx) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[st.menuItem, idx !== MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.divider }]}
                  onPress={() => {
                    if (item.route) router.push(item.route as any);
                    else Alert.alert('Coming Soon', `${item.label} is currently being developed.`);
                  }}
                >
                   <View style={[st.menuIcon, { backgroundColor: C.surface2 }]}>
                      <Ionicons name={item.icon as any} size={18} color={C.blue600} />
                   </View>
                   <View style={{ flex: 1 }}>
                      <Text style={[st.menuLabel, { color: C.text1 }]}>{item.label}</Text>
                      <Text style={[st.menuSub, { color: C.text3 }]}>{item.sub}</Text>
                   </View>
                   <Ionicons name="chevron-forward" size={16} color={C.text3} />
                </TouchableOpacity>
              ))}
           </View>

           {/* Sign Out */}
           <TouchableOpacity style={[st.signOutBtn, { borderColor: C.error }]} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color={C.error} />
              <Text style={[st.signOutText, { color: C.error }]}>Sign Out</Text>
           </TouchableOpacity>

           <Text style={[st.version, { color: C.text3 }]}>CleanOps v2.0 • Built with ❤️</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  roleText: { fontSize: 12, fontWeight: '600' },
  editBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  statsBar: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statDivider: { width: 1, height: 24, marginHorizontal: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },

  content: { padding: 16, gap: 16 },
  card: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  infoList: { gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, fontWeight: '500' },
  infoVal: { fontSize: 13, fontWeight: '700' },

  menuCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '700' },
  menuSub: { fontSize: 12, marginTop: 1 },

  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themeBtnText: { fontSize: 12, fontWeight: '700' },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 16, borderWidth: 1.5, marginTop: 8 },
  signOutText: { fontSize: 16, fontWeight: '800' },
  version: { textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: 8 },
});
