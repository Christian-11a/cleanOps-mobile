import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, STATUS_COLORS, DARK_STATUS_COLORS } from '@/constants/colors';

type ColorMode = 'light' | 'dark' | 'system';
export type AppColors = typeof LightColors;

interface ThemeContextValue {
  colors: AppColors;
  statusColors: typeof STATUS_COLORS;
  isDark: boolean;
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  statusColors: STATUS_COLORS,
  isDark: false,
  colorMode: 'system',
  setColorMode: () => {},
});

const STORAGE_KEY = '@co_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ColorMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setMode(v);
    });
  }, []);

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';

  function setColorMode(m: ColorMode) {
    setMode(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  }

  return (
    <ThemeContext.Provider value={{
      colors: isDark ? DarkColors : LightColors,
      statusColors: isDark ? DARK_STATUS_COLORS : STATUS_COLORS,
      isDark,
      colorMode: mode,
      setColorMode,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColors() { return useContext(ThemeContext).colors; }
export function useTheme()  { return useContext(ThemeContext); }
export function useStatusColors() { return useContext(ThemeContext).statusColors; }
