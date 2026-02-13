/*
  # Add park: Plose Plosebob
  Non-destructive, idempotent insert.
*/

INSERT INTO public.parks (id, slug, name, is_active)
VALUES (gen_random_uuid(), 'plose-plosebob', 'Plose Plosebob', true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;
