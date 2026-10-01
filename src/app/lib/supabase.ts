import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// 1. Create a dummy storage for Server-Side Rendering (Node.js)
const SSRStorage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => null,
  removeItem: (key: string) => null,
};

// 2. Select storage based on environment
const getStorage = () => {
  if (Platform.OS === 'web') {
    // If on web, check if window exists (Browser vs Node SSR)
    return typeof window !== 'undefined' ? window.localStorage : SSRStorage;
  }
  // If on iOS/Android, use AsyncStorage
  return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage() as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});