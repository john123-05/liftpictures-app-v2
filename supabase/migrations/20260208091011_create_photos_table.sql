/*
  # Create photos table

  1. New Tables
    - `photos`
      - `id` (uuid, primary key) - Unique identifier for each photo
      - `created_at` (timestamptz) - When the record was created in the database
      - `captured_at` (timestamptz) - When the photo was actually taken
      - `storage_bucket` (text) - Name of the Supabase storage bucket (default: 'test')
      - `storage_path` (text) - Path/filename of the image in the bucket
      - `owner_user_id` (uuid, nullable) - User who owns this photo (for future claiming feature)
  
  2. Security
    - Enable RLS on `photos` table
    - Add policy for authenticated users to read all photos
    - Add policy for authenticated users to update photos they own
  
  3. Indexes
    - Index on `captured_at` for efficient sorting
    - Index on `owner_user_id` for filtering by owner
*/

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  storage_bucket text NOT NULL DEFAULT 'test',
  storage_path text NOT NULL,
  owner_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all photos"
  ON photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own photos"
  ON photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS photos_captured_at_idx ON photos(captured_at DESC);
CREATE INDEX IF NOT EXISTS photos_owner_user_id_idx ON photos(owner_user_id);