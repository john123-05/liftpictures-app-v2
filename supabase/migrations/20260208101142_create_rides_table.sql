/*
  # Create Rides Table

  1. New Tables
    - `rides`
      - `id` (uuid, primary key) - Unique identifier for each ride
      - `user_id` (uuid, not null) - Foreign key to auth.users
      - `ride_at` (timestamptz, not null) - Timestamp when user rode
      - `source` (text, not null) - How ride was captured: 'now', 'manual', or 'qr'
      - `note` (text, nullable) - Optional note (ride number, lane, seat, etc.)
      - `created_at` (timestamptz, not null) - When record was created

  2. Indexes
    - Index on (user_id, ride_at desc) for efficient user ride queries

  3. Security
    - Enable RLS on `rides` table
    - Add policy for authenticated users to SELECT their own rides
    - Add policy for authenticated users to INSERT their own rides
    - Add policy for authenticated users to DELETE their own rides
*/

CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('now', 'manual', 'qr')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS rides_user_ride_at_idx ON rides(user_id, ride_at DESC);

-- Enable RLS
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own rides
CREATE POLICY "Users can read own rides"
  ON rides
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own rides
CREATE POLICY "Users can insert own rides"
  ON rides
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own rides
CREATE POLICY "Users can delete own rides"
  ON rides
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);