/*
  # LiftPictures Database Schema

  ## Overview
  Complete database schema for LiftPictures app with user ride tracking, photo management, favorites, and purchases.

  ## New Tables

  ### 1. rides
  Tracks user ride timeslots for matching with photos
  - `id` (uuid, primary key) - Unique ride identifier
  - `user_id` (uuid, foreign key) - References auth.users, cascade delete
  - `ride_at` (timestamptz) - When the ride occurred
  - `source` (text) - How ride was created: 'now', 'manual', or 'qr'
  - `note` (text, nullable) - Optional user note
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. photos
  Stores metadata for photos from camera/FTP ingestion
  - `id` (uuid, primary key) - Unique photo identifier
  - `captured_at` (timestamptz) - When photo was taken
  - `storage_bucket` (text) - Supabase storage bucket name
  - `storage_path` (text) - Path within bucket
  - `created_at` (timestamptz) - Record creation timestamp
  - Unique constraint on (storage_bucket, storage_path)

  ### 3. favorites
  User favorites/bookmarks for photos
  - `id` (uuid, primary key) - Unique favorite identifier
  - `user_id` (uuid, foreign key) - References auth.users, cascade delete
  - `photo_id` (uuid, foreign key) - References photos, cascade delete
  - `created_at` (timestamptz) - When favorited
  - Unique constraint on (user_id, photo_id)

  ### 4. purchases
  Purchase records for photo unlocks (minimal scaffold for future payment integration)
  - `id` (uuid, primary key) - Unique purchase identifier
  - `user_id` (uuid, foreign key) - References auth.users, cascade delete
  - `photo_id` (uuid, foreign key) - References photos, cascade delete
  - `status` (text) - Payment status: 'pending', 'paid', 'failed', or 'refunded'
  - `provider` (text, nullable) - Payment provider (e.g., 'stripe')
  - `provider_ref` (text, nullable) - External reference (e.g., checkout_session_id)
  - `created_at` (timestamptz) - Purchase creation timestamp
  - Unique constraint on (user_id, photo_id)

  ## Indexes

  ### rides
  - (user_id, ride_at DESC) - Efficient user ride queries sorted by time

  ### photos
  - (captured_at DESC) - Efficient photo queries sorted by capture time

  ### favorites
  - (user_id, created_at DESC) - Efficient user favorites queries

  ### purchases
  - (user_id, created_at DESC) - Efficient user purchase history queries

  ## Security (Row Level Security)

  ### rides
  - Enabled RLS
  - Users can SELECT, INSERT, DELETE their own rides only
  - No UPDATE policy (rides are immutable after creation)

  ### photos
  - Enabled RLS
  - All authenticated users can SELECT (view) photos
  - INSERT/UPDATE/DELETE restricted (server-side ingestion only)

  ### favorites
  - Enabled RLS
  - Users can SELECT, INSERT, DELETE their own favorites only

  ### purchases
  - Enabled RLS
  - Users can SELECT their own purchases
  - Users can INSERT pending purchases
  - UPDATE/DELETE restricted (server/webhook only)

  ## Views

  ### user_photos_unlocked
  Helper view showing photos unlocked by current user through paid purchases
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLE: rides
-- =====================================================
CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('now', 'manual', 'qr')) DEFAULT 'manual',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient user ride queries
CREATE INDEX IF NOT EXISTS idx_rides_user_ride_at ON rides(user_id, ride_at DESC);

-- Enable RLS
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rides
DO $$
BEGIN
  -- SELECT: Users can view their own rides
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rides' AND policyname = 'Users can view own rides'
  ) THEN
    CREATE POLICY "Users can view own rides"
      ON rides
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- INSERT: Users can create their own rides
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rides' AND policyname = 'Users can create own rides'
  ) THEN
    CREATE POLICY "Users can create own rides"
      ON rides
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- DELETE: Users can delete their own rides
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rides' AND policyname = 'Users can delete own rides'
  ) THEN
    CREATE POLICY "Users can delete own rides"
      ON rides
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- TABLE: photos
-- =====================================================
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'test',
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_photo_storage UNIQUE(storage_bucket, storage_path)
);

-- Create index for efficient photo queries by capture time
CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos(captured_at DESC);

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for photos
DO $$
BEGIN
  -- SELECT: All authenticated users can view photos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'photos' AND policyname = 'Authenticated users can view photos'
  ) THEN
    CREATE POLICY "Authenticated users can view photos"
      ON photos
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- TABLE: favorites
-- =====================================================
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_favorite UNIQUE(user_id, photo_id)
);

-- Create index for efficient user favorites queries
CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for favorites
DO $$
BEGIN
  -- SELECT: Users can view their own favorites
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can view own favorites'
  ) THEN
    CREATE POLICY "Users can view own favorites"
      ON favorites
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- INSERT: Users can create their own favorites
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can create own favorites'
  ) THEN
    CREATE POLICY "Users can create own favorites"
      ON favorites
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- DELETE: Users can delete their own favorites
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can delete own favorites'
  ) THEN
    CREATE POLICY "Users can delete own favorites"
      ON favorites
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- TABLE: purchases
-- =====================================================
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  provider text,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_purchase UNIQUE(user_id, photo_id)
);

-- Create index for efficient user purchase queries
CREATE INDEX IF NOT EXISTS idx_purchases_user_created ON purchases(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchases
DO $$
BEGIN
  -- SELECT: Users can view their own purchases
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Users can view own purchases'
  ) THEN
    CREATE POLICY "Users can view own purchases"
      ON purchases
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- INSERT: Users can create pending purchases
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Users can create pending purchases'
  ) THEN
    CREATE POLICY "Users can create pending purchases"
      ON purchases
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id AND status = 'pending');
  END IF;
END $$;

-- =====================================================
-- VIEW: user_photos_unlocked
-- =====================================================
CREATE OR REPLACE VIEW user_photos_unlocked AS
SELECT 
  p.id as photo_id,
  p.captured_at,
  p.storage_bucket,
  p.storage_path,
  pur.created_at as unlocked_at
FROM photos p
INNER JOIN purchases pur ON pur.photo_id = p.id
WHERE pur.user_id = auth.uid()
  AND pur.status = 'paid';