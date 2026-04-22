CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE
);

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf text NOT NULL,
  row text
);

CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  cover_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  publisher text,
  established_by text,
  translator text,
  original_title text,
  transliterated_title text,
  transliterated_author text,
  isbn text,
  synopsis text,
  cover_url text,
  online_url text,
  language text,
  published_date text,
  status text DEFAULT 'AVAILABLE', 
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  private_note text,
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  volume_number integer,
  original_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.book_categories (
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);

CREATE TABLE public.book_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
  copy_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'AVAILABLE',
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  private_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(book_id, copy_number)
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow ALL temporarily" ON public.books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.book_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.book_copies FOR ALL USING (true) WITH CHECK (true);
