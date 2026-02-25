/*
  # Claim resolver RPC

  Resolves a 16-digit claim code to exactly one photo id for public claim flow.
  Strategy:
  1) Find by photos.external_code
  2) Fallback: find by normalized storage_path in photos and persist external_code
  3) Fallback: find matching storage.objects row and create/update photos entry
*/

CREATE OR REPLACE FUNCTION public.find_claim_photo(p_code text)
RETURNS TABLE (id uuid, external_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_photo_id uuid;
  v_bucket text;
  v_name text;
  v_created_at timestamptz;
  v_prefix text;
  v_customer_code text;
  v_park_id uuid;
  v_candidate_count integer;
  v_attraction_id uuid;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[0-9]{16}$' THEN
    RETURN;
  END IF;

  -- 1) Fast path: exact external code
  SELECT p.id
  INTO v_photo_id
  FROM public.photos p
  WHERE p.external_code = p_code
  ORDER BY p.created_at ASC, p.id ASC
  LIMIT 1;

  IF v_photo_id IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.external_code
    FROM public.photos p
    WHERE p.id = v_photo_id;
    RETURN;
  END IF;

  -- 2) Fallback: normalize from photos.storage_path
  SELECT p.id
  INTO v_photo_id
  FROM public.photos p
  CROSS JOIN LATERAL (
    SELECT NULLIF(
      regexp_replace(
        regexp_replace(COALESCE(p.storage_path, ''), '^.*/', ''),
        '\\.[^.]+$',
        ''
      ),
      ''
    ) AS stem
  ) s
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN s.stem ~ '^[0-9]{16}$' THEN s.stem
      WHEN s.stem ~ '^[0-9]{20}$' THEN left(s.stem, 16)
      WHEN s.stem ~ '^[0-9]{16}[_-].*$' THEN substring(s.stem FROM '^([0-9]{16})')
      ELSE NULL
    END AS code
  ) c
  WHERE c.code = p_code
  ORDER BY p.created_at ASC, p.id ASC
  LIMIT 1;

  IF v_photo_id IS NOT NULL THEN
    BEGIN
      UPDATE public.photos p
      SET external_code = p_code
      WHERE p.id = v_photo_id
        AND (p.external_code IS NULL OR p.external_code = p_code);
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;

    RETURN QUERY
    SELECT p.id, p.external_code
    FROM public.photos p
    WHERE p.id = v_photo_id;
    RETURN;
  END IF;

  -- 3) Fallback: resolve directly from storage.objects and ensure photos row exists
  SELECT o.bucket_id, o.name, o.created_at
  INTO v_bucket, v_name, v_created_at
  FROM storage.objects o
  CROSS JOIN LATERAL (
    SELECT NULLIF(
      regexp_replace(
        regexp_replace(COALESCE(o.name, ''), '^.*/', ''),
        '\\.[^.]+$',
        ''
      ),
      ''
    ) AS stem
  ) s
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN s.stem ~ '^[0-9]{16}$' THEN s.stem
      WHEN s.stem ~ '^[0-9]{20}$' THEN left(s.stem, 16)
      WHEN s.stem ~ '^[0-9]{16}[_-].*$' THEN substring(s.stem FROM '^([0-9]{16})')
      ELSE NULL
    END AS code
  ) c
  WHERE c.code = p_code
  ORDER BY o.created_at ASC, o.id ASC
  LIMIT 1;

  IF v_name IS NULL THEN
    RETURN;
  END IF;

  v_prefix := public.path_prefix(v_name);
  v_customer_code := public.parse_source_customer_code(v_name);

  IF v_prefix IS NOT NULL THEN
    SELECT ppp.park_id
    INTO v_park_id
    FROM public.park_path_prefixes ppp
    WHERE ppp.path_prefix = v_prefix
      AND ppp.is_active = true
    LIMIT 1;
  END IF;

  IF v_park_id IS NULL AND v_customer_code IS NOT NULL THEN
    SELECT COUNT(DISTINCT pc.park_id), MIN(pc.park_id::text)::uuid
    INTO v_candidate_count, v_park_id
    FROM public.park_cameras pc
    WHERE pc.customer_code = v_customer_code
      AND pc.is_active = true;

    IF COALESCE(v_candidate_count, 0) <> 1 THEN
      v_park_id := NULL;
    END IF;
  END IF;

  IF v_park_id IS NULL THEN
    SELECT COUNT(DISTINCT psb.park_id), MIN(psb.park_id::text)::uuid
    INTO v_candidate_count, v_park_id
    FROM public.park_storage_buckets psb
    WHERE psb.bucket_id = v_bucket;

    IF COALESCE(v_candidate_count, 0) <> 1 THEN
      v_park_id := '11111111-1111-1111-1111-111111111111'::uuid;
    END IF;
  END IF;

  SELECT pc.attraction_id
  INTO v_attraction_id
  FROM public.park_cameras pc
  WHERE pc.park_id = v_park_id
    AND pc.customer_code = v_customer_code
    AND pc.is_active = true
  LIMIT 1;

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
      external_code,
      created_at
    )
    VALUES (
      v_bucket,
      v_name,
      v_created_at,
      public.parse_speed_kmh(v_name),
      v_customer_code,
      public.parse_source_time_code(v_name),
      public.parse_source_file_code(v_name),
      public.parse_speed_kmh(v_name),
      v_customer_code,
      v_attraction_id,
      v_park_id,
      p_code,
      now()
    )
    ON CONFLICT (park_id, storage_bucket, storage_path)
    DO UPDATE SET external_code = COALESCE(public.photos.external_code, EXCLUDED.external_code)
    RETURNING public.photos.id INTO v_photo_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT p.id
      INTO v_photo_id
      FROM public.photos p
      WHERE p.external_code = p_code
      LIMIT 1;
  END;

  IF v_photo_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.external_code
  FROM public.photos p
  WHERE p.id = v_photo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_claim_photo(text) TO anon, authenticated;
