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

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error || !user || !password) {
      const authErr = new Error('Invalid email or password');
      (authErr as Error & { statusCode?: number }).statusCode = 401;
      throw authErr;
    }

    // Compare password
    const isMatch = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!isMatch) {
      const authErr = new Error('Invalid email or password');
      (authErr as Error & { statusCode?: number }).statusCode = 401;
      throw authErr;
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
}
