/*
  # Print QR Claim foundation

  1) photos.external_code
     - Add external_code (text) for 16-digit print claim codes
     - Add unique index to guarantee one photo per external code

  2) unlocked_photos uniqueness hardening
     - Remove historical duplicates by (user_id, photo_id)
     - Ensure uniqueness exists for (user_id, photo_id)

  3) unlocked_photos insert policy
     - Allow authenticated users to insert own unlock rows
*/

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS external_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_external_code_unique
  ON public.photos (external_code)
  WHERE external_code IS NOT NULL;

WITH ranked_unlocks AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY user_id, photo_id
      ORDER BY unlocked_at ASC, id ASC
    ) AS rn
  FROM public.unlocked_photos
)
DELETE FROM public.unlocked_photos up
USING ranked_unlocks r
WHERE up.ctid = r.ctid
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'unlocked_photos'
      AND indexdef ILIKE '%UNIQUE INDEX%'
      AND indexdef ILIKE '%(user_id, photo_id)%'
  ) THEN
    CREATE UNIQUE INDEX idx_unlocked_photos_user_photo_unique
      ON public.unlocked_photos (user_id, photo_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'unlocked_photos'
      AND policyname = 'Users can insert own unlocked photos'
  ) THEN
    CREATE POLICY "Users can insert own unlocked photos"
      ON public.unlocked_photos
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
