-- ─────────────────────────────────────────────────────────────────────────────
-- Fix nazione Column Size Constraint
-- ─────────────────────────────────────────────────────────────────────────────
-- The nazione column was created as character varying with no length constraint
-- in the baseline migration. This migration sets an explicit size limit of 100
-- characters, consistent with the Zod `.max(100)` validation added in the schema.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ALTER COLUMN nazione TYPE character varying(100);
