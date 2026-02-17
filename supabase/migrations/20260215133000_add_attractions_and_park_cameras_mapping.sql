/*
  # Add attractions + park camera mapping for C/T/F ingestion

  ## Goal
  - Map source customer/camera code to an attraction per park
  - Enrich `photos` with `camera_code` + `attraction_id`
  - Keep existing flows non-destructive and backward compatible
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id uuid NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attractions_park_slug_unique UNIQUE (park_id, slug)
);

CREATE TABLE IF NOT EXISTS public.park_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id uuid NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  customer_code text NOT NULL,
  camera_name text,
  attraction_id uuid REFERENCES public.attractions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT park_cameras_park_customer_unique UNIQUE (park_id, customer_code)
);

CREATE INDEX IF NOT EXISTS idx_attractions_park_id ON public.attractions(park_id);
CREATE INDEX IF NOT EXISTS idx_park_cameras_park_id ON public.park_cameras(park_id);
CREATE INDEX IF NOT EXISTS idx_park_cameras_attraction_id ON public.park_cameras(attraction_id);

-- -------------------------------------------------------------------
-- Photos extension
-- -------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'attraction_id'
  ) THEN
    ALTER TABLE public.photos
      ADD COLUMN attraction_id uuid REFERENCES public.attractions(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'camera_code'
  ) THEN
    ALTER TABLE public.photos
      ADD COLUMN camera_code text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_photos_park_attraction
  ON public.photos(park_id, attraction_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_photos_camera_code
  ON public.photos(park_id, camera_code, captured_at DESC);

-- -------------------------------------------------------------------
-- RLS / policies (read for authenticated, writes via service role/admin)
-- -------------------------------------------------------------------

ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.park_cameras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attractions'
      AND policyname = 'Authenticated can read active attractions'
  ) THEN
    CREATE POLICY "Authenticated can read active attractions"
      ON public.attractions
      FOR SELECT
      TO authenticated
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.parks p
          WHERE p.id = attractions.park_id
            AND p.is_active = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'park_cameras'
      AND policyname = 'Authenticated can read active park cameras'
  ) THEN
    CREATE POLICY "Authenticated can read active park cameras"
      ON public.park_cameras
      FOR SELECT
      TO authenticated
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.parks p
          WHERE p.id = park_cameras.park_id
            AND p.is_active = true
        )
      );
  END IF;
END $$;

-- -------------------------------------------------------------------
-- Ensure parser functions exist (idempotent)
-- -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.filename_stem(path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(split_part(path, '/', array_length(string_to_array(path, '/'), 1)), '\.[^.]+$', '')
$$;

CREATE OR REPLACE FUNCTION public.parse_speed_kmh(path text)
RETURNS numeric AS $$
DECLARE
  stem text;
  kmh_match text;
  suffix_match text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  kmh_match := (regexp_matches(path, '(\d{1,3}[,\.]\d{1,2})\s*km/h', 'i'))[1];
  IF kmh_match IS NOT NULL THEN
    RETURN replace(kmh_match, ',', '.')::numeric;
  END IF;

  stem := public.filename_stem(path);
  suffix_match := (regexp_matches(stem, '_[sS](\d{4})$'))[1];
  IF suffix_match IS NOT NULL THEN
    RETURN (suffix_match::numeric / 100.0);
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.parse_source_customer_code(path text)
RETURNS text AS $$
DECLARE
  stem text;
  code text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  stem := public.filename_stem(path);
  code := (regexp_matches(stem, '^(\d{4})(\d{8})(\d{4})(?:_[sS]\d{4})?$'))[1];
  RETURN code;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.parse_source_time_code(path text)
RETURNS text AS $$
DECLARE
  stem text;
  code text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  stem := public.filename_stem(path);
  code := (regexp_matches(stem, '^(\d{4})(\d{8})(\d{4})(?:_[sS]\d{4})?$'))[2];
  RETURN code;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.parse_source_file_code(path text)
RETURNS text AS $$
DECLARE
  stem text;
  code text;
BEGIN
  IF path IS NULL OR length(path) = 0 THEN
    RETURN NULL;
  END IF;

  stem := public.filename_stem(path);
  code := (regexp_matches(stem, '^(\d{4})(\d{8})(\d{4})(?:_[sS]\d{4})?$'))[3];
  RETURN code;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -------------------------------------------------------------------
-- Ingestion trigger enrichment
-- -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_storage_object()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.photos (
    storage_bucket,
    storage_path,
    captured_at,
    speed_kmh,
    source_customer_code,
    source_time_code,
    source_file_code,
    source_speed_kmh,
    camera_code,
    attraction_id,
    park_id,
    created_at
  )
  SELECT
    NEW.bucket_id,
    NEW.name,
    NEW.created_at,
    public.parse_speed_kmh(NEW.name),
    public.parse_source_customer_code(NEW.name),
    public.parse_source_time_code(NEW.name),
    public.parse_source_file_code(NEW.name),
    public.parse_speed_kmh(NEW.name),
    public.parse_source_customer_code(NEW.name),
    pc.attraction_id,
    psb.park_id,
    now()
  FROM public.park_storage_buckets psb
  LEFT JOIN public.park_cameras pc
    ON pc.park_id = psb.park_id
   AND pc.customer_code = public.parse_source_customer_code(NEW.name)
   AND pc.is_active = true
  WHERE psb.bucket_id = NEW.bucket_id
  ON CONFLICT (park_id, storage_bucket, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------
-- Backfill
-- -------------------------------------------------------------------

UPDATE public.photos p
SET camera_code = COALESCE(
  p.camera_code,
  p.source_customer_code,
  public.parse_source_customer_code(p.storage_path)
)
WHERE p.storage_path IS NOT NULL;

UPDATE public.photos p
SET attraction_id = pc.attraction_id
FROM public.park_cameras pc
WHERE p.attraction_id IS NULL
  AND pc.is_active = true
  AND p.park_id = pc.park_id
  AND COALESCE(p.camera_code, p.source_customer_code, public.parse_source_customer_code(p.storage_path)) = pc.customer_code;

