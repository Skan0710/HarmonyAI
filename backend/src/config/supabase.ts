import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Database } from '../types/database.types';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://xyjfwwztbtsqzegargpa.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('genres').select('id').limit(1);
    if (error) {
      console.error('[Database] Supabase connection check failed:', error.message);
      return false;
    }
    console.log('[Database] Supabase Connected successfully to project xyjfwwztbtsqzegargpa');
    return true;
  } catch (err) {
    console.error('[Database] Supabase connection error:', err instanceof Error ? err.message : err);
    return false;
  }
};
