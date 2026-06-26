import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { supabaseStorage } from './storage';

const supabaseUrl = 'https://rvbvgygbobomoflbcvsu.supabase.co';
const supabaseAnonKey = 'sb_publishable_X-PH-jgHmbC0ThFjhxDYSQ_QvFv4Yia';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

