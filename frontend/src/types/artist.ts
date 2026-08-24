export interface Artist {
  _id: string;
  name: string;
  bio?: string;
  profileImage?: string;
  avatar?: string;
  monthlyListeners?: number;
  verified?: boolean;
}
