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
  park_id?: string | null;
  camera_code?: string | null;
  attraction_id?: string | null;
  source_customer_code?: string | null;
  source_time_code?: string | null;
  source_file_code?: string | null;
  source_speed_kmh?: number | null;
}

export interface Attraction {
  id: string;
  park_id: string;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParkCamera {
  id: string;
  park_id: string;
  customer_code: string;
  camera_name?: string | null;
  attraction_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParkPathPrefix {
  id: string;
  park_id: string;
  path_prefix: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  userId: string;
  timestamp: string;
  track: string;
  time: string;
  maxSpeed: number;
  photos: Photo[];
  park_id?: string | null;
  camera_code?: string | null;
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
