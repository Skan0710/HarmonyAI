import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { generateToken } from '../utils/jwt.js';

export interface RegisterInput {
  name: string;
  email: string;
  password?: string;
  profilePicture?: string;
}

export interface LoginInput {
  email: string;
  password?: string;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
    createdAt: Date;
  };
  token: string;
}

interface FailedAttemptRecord {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const FAILED_ATTEMPT_LIMIT = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Per-account failed-login tracking, independent of IP — an attacker
// distributing attempts across many IPs against one email is not slowed by
// the IP-based route limiter alone. In-memory is sufficient here since this
// process is the sole auth authority (no distributed session store).
const failedAttemptsByEmail = new Map<string, FailedAttemptRecord>();

export class AuthService {
  static async register(input: RegisterInput): Promise<AuthResult> {
    const { name, email, password, profilePicture } = input;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      const error = new Error('User with this email already exists');
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Create user in Supabase
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        profile_picture: profilePicture || '',
      })
      .select()
      .single();

    if (insertError || !user) {
      throw new Error(`Registration failed: ${insertError?.message}`);
    }

    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profile_picture || undefined,
        createdAt: user.created_at ? new Date(user.created_at) : new Date(),
      },
      token,
    };
  }

  static async login(input: LoginInput): Promise<AuthResult> {
    const { email, password } = input;
    const normalizedEmail = email.toLowerCase().trim();

    const now = Date.now();
    const existingRecord = failedAttemptsByEmail.get(normalizedEmail);
    if (existingRecord?.lockedUntil && existingRecord.lockedUntil > now) {
      const authErr = new Error('Too many failed login attempts for this account. Please try again later.');
      (authErr as Error & { statusCode?: number }).statusCode = 429;
      throw authErr;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error || !user || !password) {
      this.registerFailedLoginAttempt(normalizedEmail, now);
      const authErr = new Error('Invalid email or password');
      (authErr as Error & { statusCode?: number }).statusCode = 401;
      throw authErr;
    }

    // Compare password
    const isMatch = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!isMatch) {
      this.registerFailedLoginAttempt(normalizedEmail, now);
      const authErr = new Error('Invalid email or password');
      (authErr as Error & { statusCode?: number }).statusCode = 401;
      throw authErr;
    }

    failedAttemptsByEmail.delete(normalizedEmail);
    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profile_picture || undefined,
        createdAt: user.created_at ? new Date(user.created_at) : new Date(),
      },
      token,
    };
  }

  private static registerFailedLoginAttempt(normalizedEmail: string, now: number): void {
    const record = failedAttemptsByEmail.get(normalizedEmail);

    if (!record || now - record.windowStart > FAILED_ATTEMPT_WINDOW_MS) {
      failedAttemptsByEmail.set(normalizedEmail, { count: 1, windowStart: now });
      return;
    }

    record.count += 1;
    if (record.count >= FAILED_ATTEMPT_LIMIT) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
  }
}
