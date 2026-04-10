import { createClient } from '@supabase/supabase-js'

// Je garde les variables d'environnement dans le fichier .env.local pour pas que les clés soient en dur dans le code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// J'initialise le client Supabase qui servira de pont entre mon React et la base PostgreSQL
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
