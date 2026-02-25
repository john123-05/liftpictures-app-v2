/*
  # Allow anonymous claim photo lookup

  Claim flow needs to resolve `/claim?code=...` before login.
  Add a narrow read policy for anon users on rows that have an external_code.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'photos'
      AND policyname = 'Anon can read claimable photos'
  ) THEN
    CREATE POLICY "Anon can read claimable photos"
      ON public.photos
      FOR SELECT
      TO anon
      USING (external_code IS NOT NULL);
  END IF;
END $$;
