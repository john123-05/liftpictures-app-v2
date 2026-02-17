/*
  # Prefix-based park routing + admin users

  Goal:
  - Route shared bucket uploads by path prefix (park_slug/...)
  - Add operator admin table for server-side admin dashboard checks
  - Keep all existing flows non-destructive
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------
-- Admin users
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Users can read own admin flag'
  ) THEN
    CREATE POLICY "Users can read own admin flag"
      ON public.admin_users
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- -------------------------------------------------------------------
-- Park path prefixes for shared bucket routing
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.park_path_prefixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id uuid NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  path_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT park_path_prefixes_path_prefix_unique UNIQUE (path_prefix)
);

CREATE INDEX IF NOT EXISTS idx_park_path_prefixes_park_id
  ON public.park_path_prefixes (park_id);

ALTER TABLE public.park_path_prefixes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'park_path_prefixes'
      AND policyname = 'Authenticated can read active park path prefixes'
  ) THEN
    CREATE POLICY "Authenticated can read active park path prefixes"
      ON public.park_path_prefixes
      FOR SELECT
      TO authenticated
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.parks p
          WHERE p.id = park_path_prefixes.park_id
            AND p.is_active = true
        )
      );
  END IF;
END $$;

-- Seed one prefix per existing park slug if missing.
INSERT INTO public.park_path_prefixes (park_id, path_prefix)
SELECT p.id, p.slug
FROM public.parks p
LEFT JOIN public.park_path_prefixes ppp ON ppp.park_id = p.id
WHERE ppp.id IS NULL
ON CONFLICT (path_prefix) DO NOTHING;

-- -------------------------------------------------------------------
-- Shared-bucket routing trigger helpers
-- -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.path_prefix(path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN path IS NULL OR length(path) = 0 OR position('/' in path) = 0 THEN NULL
    ELSE split_part(path, '/', 1)
  END
$$;

-- Ensure photos unique key is still park-aware.
CREATE UNIQUE INDEX IF NOT EXISTS photos_park_bucket_path_unique_idx
  ON public.photos (park_id, storage_bucket, storage_path);

-- Prefix routing: NEW.name must look like "park-slug/filename.jpg"
CREATE OR REPLACE FUNCTION public.handle_new_storage_object()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix text;
BEGIN
  v_prefix := public.path_prefix(NEW.name);

  IF v_prefix IS NULL THEN
    -- Ignore files without park prefix in shared-bucket mode.
    RETURN NEW;
  END IF;

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
    ppp.park_id,
    now()
  FROM public.park_path_prefixes ppp
  LEFT JOIN public.park_cameras pc
    ON pc.park_id = ppp.park_id
   AND pc.customer_code = public.parse_source_customer_code(NEW.name)
   AND pc.is_active = true
  WHERE ppp.path_prefix = v_prefix
    AND ppp.is_active = true
  ON CONFLICT (park_id, storage_bucket, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill missing camera_code and attraction_id if mapping now exists.
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
