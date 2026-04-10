import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'

export default function Home() {
    const [books, setBooks] = useState([])
    const [loading, setLoading] = useState(true)

    // Dès que la page Vitrine s'affiche au public, on lance la requête select sur la DB Supabase !
    useEffect(() => {
        fetchBooks()
    }, [])

    const fetchBooks = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(16) // On limite pour avoir les ajouts les plus récents en évidence

        if (!error && data) {
            setBooks(data)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-700">
            {/* Superbe Hero Section pour marquer le coup auprès de l'institut */}
            <div className="flex flex-col items-center justify-center p-14 text-center bg-gradient-to-tr from-indigo-50 via-white to-sky-50 rounded-[2rem] shadow-sm border border-indigo-100/50">
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-indigo-100 text-indigo-800 mb-6">
                    V1.0 - Accès Beta
                </div>
                <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 text-slate-900">
                    Bibliothèque centrale <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">Institut Iman</span>
                </h1>
                <p className="text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
                    Explorez notre catalogue numérisé d'ouvrages académiques et retrouvez instantanément leur disponibilité sur étagère.
                </p>

                {/* Barre de recherche factice pour la V1, qui tape à l'oeil */}
                <div className="flex w-full max-w-xl items-center space-x-3 bg-white p-3 rounded-2xl border shadow-lg shadow-indigo-100/20">
                    <input
                        type="text"
                        placeholder="Recherche : 'Tafsir', 'Histoire'..."
                        className="flex h-12 w-full bg-transparent px-4 text-base outline-none placeholder:text-slate-400 focus:outline-none"
                    />
                    <Button size="lg" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-8">Rechercher</Button>
                </div>
            </div>

            {/* Grille des résultats en direct */}
            <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Derniers ajouts au catalogue</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {loading ? (
                        <div className="col-span-full py-12 text-center text-slate-500 animate-pulse">
                            Exploration des étagères numériques...
                        </div>
                    ) : books.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-slate-500 text-lg">La bibliothèque semble encore vide. ✨</p>
                            <p className="text-sm text-slate-400 mt-2">Passez par l'Espace Admin pour aspirer le premier livre !</p>
                        </div>
                    ) : (
                        books.map(book => (
                            <Card key={book.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group">
                                <div className="h-56 w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b">
                                    {book.cover_url ? (
                                        <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <span className="text-slate-400 font-medium">Livre classique</span>
                                    )}
                                </div>
                                <CardHeader className="p-5 pb-4 bg-white">
                                    <div className="flex items-center justify-between mb-3">
                                        <Badge variant={book.is_available ? "default" : "secondary"} className={book.is_available ? "bg-emerald-500 hover:bg-emerald-600 border-transparent text-white" : "bg-slate-200 text-slate-700"}>
                                            {book.is_available ? "Dispo sur étagère" : "Emprunté"}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl line-clamp-1 text-slate-800" title={book.title}>{book.title}</CardTitle>
                                    <CardDescription className="line-clamp-1 text-indigo-600 font-medium">{book.author || "Auteur inconnu"}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-5 pt-0 bg-white">
                                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                                        {book.synopsis || "Aucun résumé n'a été rattaché à cet ouvrage."}
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
