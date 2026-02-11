/*
  # Auto-populate leaderboard from unlocked photos

  ## Why
  Ensure Tagesranking updates immediately whenever a photo becomes unlocked,
  independent of edge function deployment/version.

  ## Changes
  - Trigger on `unlocked_photos` insert/upsert to write `leaderboard_entries`
  - Backfill existing unlocked rows
  - Keep public profile read policy for ranking names/avatars
*/

CREATE OR REPLACE FUNCTION public.sync_leaderboard_from_unlocked_photo()
RETURNS trigger AS $$
DECLARE
  v_speed numeric;
  v_ride_date date;
BEGIN
  SELECT
    COALESCE(
      NULLIF(p.speed_kmh, 0),
      parse_speed_kmh(p.storage_path),
      0
    ),
    (p.captured_at AT TIME ZONE 'UTC')::date
  INTO v_speed, v_ride_date
  FROM photos p
  WHERE p.id = NEW.photo_id;

  IF v_ride_date IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO leaderboard_entries (user_id, photo_id, speed_kmh, ride_date)
  VALUES (NEW.user_id, NEW.photo_id, COALESCE(v_speed, 0), v_ride_date)
  ON CONFLICT (user_id, photo_id)
  DO UPDATE SET
    speed_kmh = EXCLUDED.speed_kmh,
    ride_date = EXCLUDED.ride_date;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_leaderboard_from_unlocked_photo ON unlocked_photos;
CREATE TRIGGER trg_sync_leaderboard_from_unlocked_photo
AFTER INSERT OR UPDATE ON unlocked_photos
FOR EACH ROW
EXECUTE FUNCTION public.sync_leaderboard_from_unlocked_photo();

INSERT INTO leaderboard_entries (user_id, photo_id, speed_kmh, ride_date)
SELECT
  up.user_id,
  up.photo_id,
  COALESCE(NULLIF(p.speed_kmh, 0), parse_speed_kmh(p.storage_path), 0),
  (p.captured_at AT TIME ZONE 'UTC')::date
FROM unlocked_photos up
JOIN photos p ON p.id = up.photo_id
ON CONFLICT (user_id, photo_id)
DO UPDATE SET
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
