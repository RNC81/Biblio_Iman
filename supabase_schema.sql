-- On crée une table propre pour les catégories
-- Comme ça je peux les lister et en rajouter dynamiquement dans l'espace Admin au lieu de les figer en dur dans le code
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text
);

-- Toujours centraliser les emplacements physiques (étagères, rayons) pour éviter de taper "Etagère 3", "Etagere 3", et avoir des doublons chiants
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf text NOT NULL,
  row text
);

-- La table centrale du projet !
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  isbn text,
  synopsis text,
  cover_url text,
  -- J'utilise un array text[] ici pour gérer le multilingue (ex: [Arabe, Français]) sans me casser la tête avec une table pivot 
  languages text[], 
  -- Le boolean cliquable pour savoir si le livre est sur l'étagère ou actuellement utilisé par qqn dans l'institut
  is_available boolean DEFAULT true, 
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- C'est la classique table de liaison Many-to-Many car un bouquin de l'institut peut avoir 3 ou 4 thèmes différents
CREATE TABLE public.book_categories (
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);

-- Activer le RLS (Row Level Security) c'est indispensable dans supabase en 2026. 
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_categories ENABLE ROW LEVEL SECURITY;

-- Pour l'instant je laisse tout le monde lire et écrire pour me faciliter la tache pendant que je code les composants front de la Phase 2
-- A terme, quand on passera en Prod, je reverrouillerai ça via l'Auth de supabase.
CREATE POLICY "Allow ALL temporarily" ON public.books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL temporarily" ON public.book_categories FOR ALL USING (true) WITH CHECK (true);
