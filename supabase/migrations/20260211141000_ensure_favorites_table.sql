/*
  # Ensure favorites table exists for persistent user favorites

  This migration is idempotent and safe to run multiple times.
*/

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_favorite UNIQUE(user_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can view own favorites'
  ) THEN
    CREATE POLICY "Users can view own favorites"
      ON favorites
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can create own favorites'
  ) THEN
    CREATE POLICY "Users can create own favorites"
      ON favorites
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

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
