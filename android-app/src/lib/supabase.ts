import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '../types/database';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseKey = Constants.expoConfig?.extra?.supabaseAnonKey || '';

if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  throw new Error('VITE_SUPABASE_URL format invalid');
}
if (supabaseKey && !supabaseKey.startsWith('eyJ')) {
  throw new Error('VITE_SUPABASE_ANON_KEY must be JWT format');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabaseKey;
};

export async function fetchFundNavFromEdge(code: string) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('fund-nav', { body: { code } });
  if (error) throw error;
  return data;
}

export async function searchFundsFromEdge(keyword: string) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('fund-search', { body: { keyword } });
  if (error) throw error;
  return data;
}
