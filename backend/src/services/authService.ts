import { User, IUser } from '../models/User.js';
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

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('User with this email already exists');
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      profilePicture,
    });

    const token = generateToken(user._id.toString());

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  static async login(input: LoginInput): Promise<AuthResult> {
    const { email, password } = input;

    // Find user and explicitly select password field
    const user = await User.findOne({ email }).select('+password');
    if (!user || !password) {
      const error = new Error('Invalid email or password');
      (error as Error & { statusCode?: number }).statusCode = 401;
      throw error;
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      (error as Error & { statusCode?: number }).statusCode = 401;
      throw error;
    }

    const token = generateToken(user._id.toString());

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
      },
      token,
    };
  }
}
