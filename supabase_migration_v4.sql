-- ============================================================
-- MIGRATION V4 : Exemplaires individuels + Collections
-- À exécuter dans Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. TABLE COLLECTIONS (pour regrouper les œuvres multi-volumes)
CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  cover_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. AJOUT COLONNES SUR BOOKS (collection + volume)
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS volume_number integer;

-- 3. TABLE BOOK_COPIES (suivi individuel de chaque exemplaire physique)
CREATE TABLE IF NOT EXISTS public.book_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
  copy_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'AVAILABLE',
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  private_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(book_id, copy_number)
);

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow ALL temporarily" ON public.collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.book_copies FOR ALL USING (true) WITH CHECK (true);

-- 5. MIGRATION DES DONNÉES EXISTANTES
-- Pour chaque livre physique existant (AVAILABLE ou BORROWED), 
-- on crée automatiquement 1 exemplaire avec le statut actuel du livre.
INSERT INTO public.book_copies (book_id, copy_number, status, location_id)
SELECT id, 1, 
  CASE WHEN status = 'BORROWED' THEN 'BORROWED' ELSE 'AVAILABLE' END,
  location_id
FROM public.books
WHERE status IN ('AVAILABLE', 'BORROWED');
