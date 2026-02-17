/*
  # Add camera context to rides (non-destructive)

  Goal:
  - Persist optional camera code with each captured ride.
  - Improve photo lookup reliability when uploads are delayed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rides'
      AND column_name = 'camera_code'
  ) THEN
    ALTER TABLE public.rides
      ADD COLUMN camera_code text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_user_park_camera_ride_at
  ON public.rides(user_id, park_id, camera_code, ride_at DESC);

