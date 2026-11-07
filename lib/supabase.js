import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

// Expo reads these names directly from .env.local at build/start time.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const configurationError = !url || !key
  ? 'กรุณาตั้งค่า URL และ Publishable key ใน .env.local แล้วเริ่มแอปใหม่'
  : !/^https:\/\//.test(url)
    ? 'Project URL ต้องเริ่มด้วย https://'
    : key.startsWith('sb_secret_')
      ? 'แอปต้องใช้ Publishable key เท่านั้น ห้ามใช้ Secret key'
      : '';

export const supabase = configurationError ? null : createClient(url, key, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    lock: processLock,
  },
});
