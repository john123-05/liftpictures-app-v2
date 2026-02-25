/*
  # Fix claim ranking visibility (park + speed fallback)

  Why:
  - Some claim-resolved photos can carry the fallback park id `1111...`.
  - Daily ranking filters by user park, so these rows may not appear.
  - Some camera filenames encode speed as trailing 4 digits in a 20-digit stem.

  What:
  - Update leaderboard sync trigger to prefer unlocked-photo park when photo park is fallback.
  - Add speed fallback for 20-digit filename stems.
  - Upsert/backfill leaderboard rows from existing unlocked photos.
*/

CREATE OR REPLACE FUNCTION public.sync_leaderboard_from_unlocked_photo()
RETURNS trigger AS $$
DECLARE
  v_speed numeric;
  v_ride_date date;
  v_park_id uuid;
BEGIN
  SELECT
    COALESCE(
      NULLIF(p.speed_kmh, 0),
      public.parse_speed_kmh(p.storage_path),
      CASE WHEN s.stem ~ '^[0-9]{20}$' THEN right(s.stem, 4)::numeric / 100.0 ELSE 0 END
    ),
    (p.captured_at AT TIME ZONE 'UTC')::date,
    COALESCE(
      NULLIF(p.park_id, '11111111-1111-1111-1111-111111111111'::uuid),
      NEW.park_id,
      '11111111-1111-1111-1111-111111111111'::uuid
    )
  INTO v_speed, v_ride_date, v_park_id
  FROM public.photos p
  CROSS JOIN LATERAL (
    SELECT NULLIF(
      regexp_replace(
        regexp_replace(COALESCE(p.storage_path, ''), '^.*/', ''),
        '\.[^.]+$',
        ''
      ),
      ''
    ) AS stem
  ) s
  WHERE p.id = NEW.photo_id;

  IF v_ride_date IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.leaderboard_entries (user_id, photo_id, speed_kmh, ride_date, park_id)
  VALUES (
    NEW.user_id,
    NEW.photo_id,
    COALESCE(v_speed, 0),
    v_ride_date,
    v_park_id
  )
  ON CONFLICT (user_id, photo_id)
  DO UPDATE SET
    speed_kmh = EXCLUDED.speed_kmh,
    ride_date = EXCLUDED.ride_date,
    park_id = EXCLUDED.park_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO public.leaderboard_entries (user_id, photo_id, speed_kmh, ride_date, park_id)
SELECT
  up.user_id,
  up.photo_id,
  COALESCE(
    NULLIF(p.speed_kmh, 0),
    public.parse_speed_kmh(p.storage_path),
    CASE WHEN s.stem ~ '^[0-9]{20}$' THEN right(s.stem, 4)::numeric / 100.0 ELSE 0 END
  ) AS speed_kmh,
  (p.captured_at AT TIME ZONE 'UTC')::date AS ride_date,
  COALESCE(
    NULLIF(p.park_id, '11111111-1111-1111-1111-111111111111'::uuid),
    up.park_id,
    '11111111-1111-1111-1111-111111111111'::uuid
  ) AS park_id
FROM public.unlocked_photos up
JOIN public.photos p ON p.id = up.photo_id
CROSS JOIN LATERAL (
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(COALESCE(p.storage_path, ''), '^.*/', ''),
      '\.[^.]+$',
      ''
    ),
    ''
  ) AS stem
) s
ON CONFLICT (user_id, photo_id)
DO UPDATE SET
  speed_kmh = EXCLUDED.speed_kmh,
  ride_date = EXCLUDED.ride_date,
  park_id = EXCLUDED.park_id;
