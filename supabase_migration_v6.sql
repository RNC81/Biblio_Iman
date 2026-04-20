-- ============================================================
-- MIGRATION V6 : Traduction (Lien Original & Traducteur)
-- À exécuter dans Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS original_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS translator text;
