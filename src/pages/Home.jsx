import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'

// Petit hook magique pour le debounce (attendre que l'utilisateur arrête de taper)
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export default function Home() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  // Le timer "Debounce" est réglé à 300ms de latence après la frappe
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Le trigger va réagir chaque fois que la valeur "debouncée" change !
  useEffect(() => {
    fetchBooks(debouncedSearch)
  }, [debouncedSearch])

  const fetchBooks = async (searchQuery = '') => {
    setLoading(true)
    let query = supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    // Si on a tapé qqchose, on lance la requête Full-Text hybride !
    if (searchQuery.trim() !== '') {
      // On cherche soit dans le titre, soit dans l'auteur, soit par isbn
      query = query.or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%,isbn.ilike.%${searchQuery}%`)
    }

    const { data, error } = await query

    if (!error && data) {
      setBooks(data)
    } else {
      console.error("Erreur de db:", error)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col items-center justify-center p-10 md:p-14 text-center bg-gradient-to-tr from-indigo-50 via-white to-sky-50 rounded-[2rem] shadow-sm border border-indigo-100/50">
        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-indigo-100 text-indigo-800 mb-6">
          V2.0 - Moteur de recherche Rapide
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight lg:text-6xl mb-4 md:mb-6 text-slate-900">
          Bibliothèque centrale <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">Institut Iman</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mb-8 md:mb-10 leading-relaxed px-4">
          Explorez notre catalogue numérisé d'ouvrages académiques et retrouvez instantanément leur disponibilité réelle sur étagère.
        </p>
        
        {/* Le moteur de recherche réagira maintenant magiquement */}
        <div className="flex w-full max-w-2xl items-center space-x-3 bg-white p-3 rounded-2xl border shadow-lg shadow-indigo-100/20 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cherchez un livre précis : Titre, Auteur, ISBN..." 
            className="flex h-12 w-full bg-transparent px-4 text-sm md:text-base outline-none placeholder:text-slate-400 focus:outline-none font-medium"
          />
          <Button size="lg" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-8" onClick={() => fetchBooks(searchTerm)}>Chercher</Button>
        </div>
      </div>
      
      <div className="space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 border-b pb-2">
          {searchTerm ? `Résultats pour "${searchTerm}" (${books.length})` : "Les derniers ajouts au catalogue"}
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-500 animate-pulse font-medium">
               Analyse des archives en cours...
            </div>
          ) : books.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
               <p className="text-slate-500 text-lg font-medium">Aucun ouvrage ne correspond à votre recherche. 🧐</p>
            </div>
          ) : (
            books.map(book => (
              <Card key={book.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group flex flex-col justify-between">
                <div>
                  <div className="h-56 w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <span className="text-slate-400 font-medium text-sm text-center px-4">Couverture non disponible</span>
                    )}
                  </div>
                  <CardHeader className="p-5 pb-2 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant={book.is_available ? "default" : "secondary"} className={book.is_available ? "bg-emerald-500 hover:bg-emerald-600 border-transparent text-white" : "bg-slate-200 text-slate-700"}>
                        {book.is_available ? "Sur étagère" : "En cours de lecture"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg md:text-xl line-clamp-2 text-slate-800 leading-tight" title={book.title}>{book.title}</CardTitle>
                    <CardDescription className="line-clamp-1 text-indigo-600 font-medium mt-1">{book.author || "Auteur inconnu"}</CardDescription>
                  </CardHeader>
                </div>
                <CardContent className="p-5 pt-2 bg-white">
                  <p className="text-xs md:text-sm text-slate-500 line-clamp-3 leading-relaxed">
                    {book.synopsis || "Aucun résumé n'a été rattaché à cet ouvrage par la direction."}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
