import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch (e) {
      console.warn('[authContext] fetchProfile:', e);
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Derive role from DB profile first, fall back to JWT metadata
  const role = (profile?.role ?? (user?.user_metadata?.role as UserRole) ?? null);
  const isBanned = profile?.is_banned === true;

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, refreshProfile }}>
      {isBanned ? (
        <View style={st.bannedContainer}>
          <Text style={st.bannedEmoji}>🚫</Text>
          <Text style={st.bannedTitle}>Access Denied</Text>
          <Text style={st.bannedDesc}>Your account has been permanently or temporarily banned for violating CleanOps policies. If you believe this is a mistake, please contact support.</Text>
          <TouchableOpacity 
            style={st.signOutBtn} 
            onPress={async () => {
               await supabase.auth.signOut();
               setProfile(null);
            }}
          >
            <Text style={st.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : children}
    </AuthContext.Provider>
  );
}

const st = StyleSheet.create({
  bannedContainer: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 40 },
  bannedEmoji: { fontSize: 64, marginBottom: 20 },
  bannedTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 12 },
  bannedDesc: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  signOutBtn: { backgroundColor: '#ef4444', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export function useAuth() {
  return useContext(AuthContext);
}
