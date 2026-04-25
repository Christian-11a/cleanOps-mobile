import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { ThemeProvider, useTheme } from '@/lib/themeContext';
import { ToastProvider, useToast } from '@/lib/toastContext';
import { NotificationProvider } from '@/lib/notificationContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoadingScreen } from '@/components/shared/LoadingScreen';

function RootNav() {
  const { user, role, loading } = useAuth();
  const { isDark } = useTheme();
  const toast    = useToast();
  const segments = useSegments();
  const router   = useRouter();
  const prevUser = useRef<typeof user>(undefined);

  // Detect unexpected sign-out (session expiry)
  useEffect(() => {
    if (loading) return;
    if (prevUser.current !== undefined && prevUser.current !== null && user === null) {
      toast.show('Your session has ended. Please sign in again.', 'info');
    }
    prevUser.current = user;
  }, [user, loading]);

  useEffect(() => {
    if (loading) return;

    const firstSeg  = segments[0] as string | undefined;
    const inPublic  = !firstSeg || firstSeg === 'login' || firstSeg === 'signup';

    if (!user) {
      if (!inPublic) router.replace('/');
    } else {
      if (inPublic || firstSeg === 'homepage') {
        if (role === 'employee')      router.replace('/employee');
        else if (role === 'admin')    router.replace('/admin/dashboard');
        else                          router.replace('/customer');
      }
    }
  }, [user, role, loading, segments]);

  if (loading) return <LoadingScreen message="Starting CleanOps…" />;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index"             />
        <Stack.Screen name="login/index"       />
        <Stack.Screen name="signup/index"      />
        
        {/* Customer Section */}
        <Stack.Screen name="customer/(tabs)"   />
        <Stack.Screen name="customer/order/index"     />
        <Stack.Screen name="customer/jobs/[id]/index" />
        
        {/* Employee Section */}
        <Stack.Screen name="employee/(tabs)"   />
        <Stack.Screen name="employee/jobs/[id]/index" />

        {/* Admin Section */}
        <Stack.Screen name="admin/dashboard/index"    />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <NotificationProvider>
                <RootNav />
              </NotificationProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
