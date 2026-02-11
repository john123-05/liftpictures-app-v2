/*
  # Backfill leaderboard + public profile visibility for ranking

  ## Changes
  - Backfill `leaderboard_entries` from existing `unlocked_photos`
  - Allow authenticated users to read `users` rows (needed for daily ranking names/avatars)
*/

INSERT INTO leaderboard_entries (user_id, photo_id, speed_kmh, ride_date)
SELECT
  up.user_id,
  up.photo_id,
  COALESCE(
    NULLIF(p.speed_kmh, 0),
    parse_speed_kmh(p.storage_path),
    0
  ) AS speed_kmh,
  (p.captured_at AT TIME ZONE 'UTC')::date AS ride_date
FROM unlocked_photos up
JOIN photos p ON p.id = up.photo_id
ON CONFLICT (user_id, photo_id) DO UPDATE
SET
  speed_kmh = EXCLUDED.speed_kmh,
  ride_date = EXCLUDED.ride_date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Authenticated users can read all profiles'
  ) THEN
    CREATE POLICY "Authenticated users can read all profiles"
      ON public.users
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
