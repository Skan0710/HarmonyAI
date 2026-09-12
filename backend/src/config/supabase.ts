import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Database } from '../types/database.types';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required. Set them in your .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('genres').select('id').limit(1);
    if (error) {
      console.error('[Database] Supabase connection check failed:', error.message);
      return false;
    }
    console.log('[Database] Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('[Database] Supabase connection error:', err instanceof Error ? err.message : err);
    return false;
  }
};
