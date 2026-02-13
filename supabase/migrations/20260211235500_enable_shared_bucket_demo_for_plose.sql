/*
  # Enable shared-bucket demo mode for Plose Plosebob

  Goal:
  - Allow multiple parks to point to the same storage bucket (demo use-case)
  - Keep photos isolated per park via (park_id, storage_bucket, storage_path)
  - Backfill existing Adventure Land photos into Plose Plosebob for bucket `test`
*/

-- 1) Allow same bucket to be mapped to multiple parks.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'park_storage_buckets'
  ) THEN
    ALTER TABLE public.park_storage_buckets DROP CONSTRAINT IF EXISTS park_storage_buckets_pkey;
    ALTER TABLE public.park_storage_buckets ADD CONSTRAINT park_storage_buckets_pkey PRIMARY KEY (bucket_id, park_id);
  END IF;
END $$;

-- 2) Make photo uniqueness park-aware.
-- Drop any legacy unique constraints on (storage_bucket, storage_path),
-- regardless of historical constraint naming.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'photos'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY u.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = t.oid
         AND a.attnum = u.attnum
      ) = ARRAY['storage_bucket','storage_path']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Extra safety for legacy index names seen in older environments.
DROP INDEX IF EXISTS public.photos_bucket_path_unique;
DROP INDEX IF EXISTS public.photos_storage_bucket_storage_path_key;
DROP INDEX IF EXISTS public.unique_photo_storage;

CREATE UNIQUE INDEX IF NOT EXISTS photos_park_bucket_path_unique_idx
  ON public.photos (park_id, storage_bucket, storage_path);

-- 3) Update storage trigger so one uploaded file can be indexed for each mapped park.
CREATE OR REPLACE FUNCTION public.handle_new_storage_object()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.photos (
    storage_bucket,
    storage_path,
    captured_at,
    speed_kmh,
    park_id,
    created_at
  )
  SELECT
    NEW.bucket_id,
    NEW.name,
    NEW.created_at,
    parse_speed_kmh(NEW.name),
    psb.park_id,
    now()
  FROM public.park_storage_buckets psb
  WHERE psb.bucket_id = NEW.bucket_id
  ON CONFLICT (park_id, storage_bucket, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Map Plose Plosebob to the same demo bucket `test`.
INSERT INTO public.park_storage_buckets (bucket_id, park_id)
SELECT 'test', p.id
FROM public.parks p
WHERE p.slug = 'plose-plosebob'
ON CONFLICT (bucket_id, park_id) DO NOTHING;

-- 5) Backfill existing Adventure Land photos from bucket `test` into Plose Plosebob.
INSERT INTO public.photos (
  storage_bucket,
  storage_path,
  captured_at,
  speed_kmh,
  owner_user_id,
  park_id,
  created_at
)
SELECT
  p.storage_bucket,
  p.storage_path,
  p.captured_at,
  p.speed_kmh,
  p.owner_user_id,
  plose.id,
  COALESCE(p.created_at, now())
FROM public.photos p
JOIN public.parks adventure ON adventure.id = p.park_id AND adventure.slug = 'adventure-land'
JOIN public.parks plose ON plose.slug = 'plose-plosebob'
WHERE p.storage_bucket = 'test'
ON CONFLICT (park_id, storage_bucket, storage_path) DO NOTHING;
