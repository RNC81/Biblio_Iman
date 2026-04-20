-- ============================================================
-- MIGRATION V7 : Titre original manuel pour les traductions
-- À exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS original_title text;
