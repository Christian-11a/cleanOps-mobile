import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/themeContext';
import { useNotifications } from '@/lib/notificationContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export default function BottomNav({ state, navigation, descriptors }: BottomTabBarProps) {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  const NAV_ITEMS: { label: string; icon: string; name?: string; route?: string; isFab?: boolean; badge?: number }[] = [
    { label: 'Home',     icon: 'home-outline',     name: 'index' },
    { label: 'Bookings', icon: 'list-outline',     name: 'jobs' },
    { label: 'Book',     icon: 'add',              route: '/customer/order', isFab: true },
    { label: 'Wallet',   icon: 'wallet-outline',   name: 'wallet' },
    { label: 'Profile',  icon: 'person-outline',   name: 'profile' },
  ];

  return (
    <View style={[st.container, { backgroundColor: isDark ? 'rgba(10, 17, 32, 0.98)' : 'rgba(255, 255, 255, 0.98)', borderTopColor: C.divider, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={st.content}>
        {NAV_ITEMS.map((item) => {
          const isTab = !item.isFab;
          const isActive = isTab ? state.routes[state.index].name === item.name : false;

          if (item.isFab) {
            return (
              <TouchableOpacity
                key={item.label}
                style={st.fabContainer}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.9}
              >
                <LinearGradient 
                  colors={['#0ea5e9', '#0284c7']} 
                  style={[st.fab, { shadowColor: C.blue600 }]}
                >
                  <Ionicons name="add" size={30} color="#fff" />
                </LinearGradient>
                <Text style={[st.label, { color: C.blue600, fontWeight: '700' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.label}
              style={st.navItem}
              onPress={() => {
                if (!isActive && item.name) {
                  navigation.navigate(item.name);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={st.iconWrapper}>
                <Ionicons 
                  name={isActive ? (item.icon.replace('-outline', '') as any) : item.icon} 
                  size={24} 
                  color={isActive ? C.blue600 : C.text3} 
                />
                {!!item.badge && (
                  <View style={st.badge}>
                    <Text style={st.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[st.label, { color: isActive ? C.blue600 : C.text3, fontWeight: isActive ? '600' : '500' }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 24 },
      android: { elevation: 16 },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 64,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrapper: {
    width: 36, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  label: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : undefined,
  },
  fabContainer: {
    width: 60,
    alignItems: 'center',
    marginTop: -24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...Platform.select({
      ios: { shadowColor: '#0284c7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 24 },
      android: { elevation: 8 },
    }),
  },
});
