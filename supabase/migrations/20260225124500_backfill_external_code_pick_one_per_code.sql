/*
  # Backfill external_code: pick one row per normalized 16-digit code

  Problem:
  - Historical ingestion may have multiple `photos` rows per logical code.
  - Previous backfill only filled codes that were globally unique, resulting in 0 rows in some datasets.

  Solution:
  - Compute normalized 16-digit code from `storage_path`.
  - Rank rows per code and set `external_code` only for rank 1.
  - Keep all other duplicates as NULL to satisfy unique index.
*/

WITH normalized AS (
  SELECT
    p.id,
    p.created_at,
    CASE
      WHEN stem ~ '^[0-9]{16}$' THEN stem
      WHEN stem ~ '^[0-9]{20}$' THEN left(stem, 16)
      WHEN stem ~ '^[0-9]{16}[_-].*$' THEN substring(stem FROM '^([0-9]{16})')
      ELSE NULL
    END AS normalized_code
  FROM (
    SELECT
      id,
      created_at,
      NULLIF(
        regexp_replace(
          regexp_replace(COALESCE(storage_path, ''), '^.*/', ''),
          '\\.[^.]+$',
          ''
        ),
        ''
      ) AS stem
    FROM public.photos
  ) p
),
ranked AS (
  SELECT
    id,
    normalized_code,
    row_number() OVER (
      PARTITION BY normalized_code
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM normalized
  WHERE normalized_code IS NOT NULL
)
UPDATE public.photos ph
SET external_code = CASE WHEN r.rn = 1 THEN r.normalized_code ELSE NULL END
FROM ranked r
WHERE ph.id = r.id
  AND ph.external_code IS DISTINCT FROM CASE WHEN r.rn = 1 THEN r.normalized_code ELSE NULL END;
