/*
  # Allow pass-only purchases

  ## Why
  Day photo pass orders may not contain a single specific photo_id.

  ## Changes
  - Make purchases.photo_id nullable
  - Remove unique constraint on (user_id, photo_id) so users can complete repeated or pass-only purchases safely
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'photo_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE purchases ALTER COLUMN photo_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_user_purchase'
      AND conrelid = 'public.purchases'::regclass
  ) THEN
    ALTER TABLE purchases DROP CONSTRAINT unique_user_purchase;
  END IF;
END $$;
