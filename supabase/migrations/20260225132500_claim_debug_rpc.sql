/*
  # Temporary claim debug RPC
*/

CREATE OR REPLACE FUNCTION public.claim_debug_info(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'code', p_code,
    'objects_total', (SELECT COUNT(*) FROM storage.objects),
    'objects_code_match_count',
      (
        SELECT COUNT(*)
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
      ),
    'photos_total', (SELECT COUNT(*) FROM public.photos),
    'photos_external_match_count',
      (SELECT COUNT(*) FROM public.photos p WHERE p.external_code = p_code),
    'photos_path_match_count',
      (
        SELECT COUNT(*)
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
      )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_debug_info(text) TO anon, authenticated;
