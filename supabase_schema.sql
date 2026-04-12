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

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  isbn text,
  synopsis text,
  cover_url text,
  online_url text,
  language text,
  published_date text,
  status text DEFAULT 'AVAILABLE', 
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  private_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.book_categories (
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow ALL temporarily" ON public.books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.book_categories FOR ALL USING (true) WITH CHECK (true);
