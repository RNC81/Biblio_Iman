-- ============================================================
-- MIGRATION V5 : Ajout Maison d'édition et Établi par
-- À exécuter dans Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS publisher text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS established_by text;
