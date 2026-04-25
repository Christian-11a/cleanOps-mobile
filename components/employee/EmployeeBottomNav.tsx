import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/themeContext';
import { useNotifications } from '@/lib/notificationContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export default function EmployeeBottomNav({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  // Mapping based on Figma: Feed, Jobs, History, Wallet, Profile
  const NAV_ITEMS: { label: string; icon: string; name: string; badge?: number }[] = [
    { label: 'Explore', icon: 'flash-outline',    name: 'index' },
    { label: 'Tasks',   icon: 'briefcase-outline', name: 'active' },
    { label: 'History', icon: 'time-outline',      name: 'history' },
    { label: 'Wallet',  icon: 'wallet-outline',    name: 'wallet' },
    { label: 'Profile', icon: 'person-outline',    name: 'profile' },
  ];

  const bgColor = isDark ? '#0A0F1E' : '#111827'; // Always dark shell per Figma
  const activeColor = '#22c55e'; // Green from Figma
  const inactiveColor = '#94a3b8';

  return (
    <View style={[st.container, { backgroundColor: bgColor, borderTopColor: 'rgba(255,255,255,0.08)', paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={st.content}>
        {NAV_ITEMS.map((item, index) => {
          const isActive = state.index === index;

          return (
            <TouchableOpacity
              key={item.label}
              style={st.navItem}
              onPress={() => {
                if (!isActive) {
                  navigation.navigate(item.name);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[st.iconWrapper, isActive && st.activeIconWrapper]}>
                <Ionicons 
                  name={(isActive ? item.icon.replace('-outline', '') : item.icon) as any} 
                  size={22} 
                  color={isActive ? activeColor : inactiveColor} 
                />
                {!!item.badge && (
                  <View style={st.badge}>
                    <Text style={st.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[st.label, { color: isActive ? activeColor : inactiveColor, fontWeight: isActive ? '700' : '500' }]}>
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
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 24 },
      android: { elevation: 20 },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 68,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrapper: {
    width: 40, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 4,
    backgroundColor: '#ef4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0A0F1E',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  label: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : undefined,
  },
});
