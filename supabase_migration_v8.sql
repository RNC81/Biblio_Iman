-- ============================================================
-- MIGRATION V8 : Ajout du Titre Translittéré
-- À exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS transliterated_title text;
