import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Database } from '../types/database.types';

const extra = (
  Constants.expoConfig?.extra ??
  (Constants as any).manifest?.extra ??
  (Constants as any).manifest2?.extra?.expoClient?.extra ??
  {}
) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const pickNonEmpty = (...values: Array<string | undefined>) =>
  values.map((v) => v?.trim()).find((v) => !!v);

const supabaseUrl = pickNonEmpty(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  extra.supabaseUrl
);
const supabaseKey = pickNonEmpty(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  extra.supabaseAnonKey
);

const missingEnv: string[] = [];

if (!supabaseUrl) {
  missingEnv.push('EXPO_PUBLIC_SUPABASE_URL');
}

if (!supabaseKey) {
  missingEnv.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const isPlaceholderUrl = supabaseUrl === 'https://your-project.supabase.co';
const isPlaceholderKey = supabaseKey === 'your-anon-key';

export const isSupabaseConfigured =
  missingEnv.length === 0 && !isPlaceholderUrl && !isPlaceholderKey;

export const supabaseConfigErrorMessage =
  'Supabase 환경변수가 설정되지 않았습니다. .env의 EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY를 실제 값으로 입력해주세요.';

if (!isSupabaseConfigured) {
  console.error(
    `[Supabase] ${supabaseConfigErrorMessage}`
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://your-project.supabase.co',
  supabaseKey || 'your-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export default supabase;
