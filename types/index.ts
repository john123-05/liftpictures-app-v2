export interface User {
  id: string;
  name: string;
  email: string;
  totalRides: number;
  totalPhotos: number;
  memberSince: string;
  bestTime?: string;
  maxSpeed?: number;
}

export interface Photo {
  id: string;
  userId: string;
  url: string;
  timestamp: string;
  track: string;
  speed: number;
  price: number;
  isFavorite: boolean;
  isPurchased: boolean;
}

export interface Ride {
  id: string;
  userId: string;
  timestamp: string;
  track: string;
  time: string;
  maxSpeed: number;
  photos: Photo[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  speed: number;
  time: string;
  isCurrentUser?: boolean;
}

export interface QRSession {
  id: string;
  rideId: string;
  photos: Photo[];
  expiresAt: string;
}