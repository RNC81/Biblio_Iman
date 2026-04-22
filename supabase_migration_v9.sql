-- ============================================================
-- MIGRATION V9 : Ajout du nom d'auteur translittéré
-- À exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS transliterated_author text;
