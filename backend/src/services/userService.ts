import { User, IUser } from '../models/User.js';

export class UserService {
  static async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId).select('-password');
  }

  static async updateProfile(
    userId: string,
    data: { name?: string; profilePicture?: string }
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(
      userId,
      { $set: data },
      { new: true, runValidators: true }
    ).select('-password');
  }
}
