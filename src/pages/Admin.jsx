import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from '@/lib/supabase'

export default function Admin() {
    const [isbn, setIsbn] = useState('')
    const [loading, setLoading] = useState(false)
    const [bookData, setBookData] = useState({ title: '', author: '', synopsis: '', cover_url: '', is_available: true })
    const [inventoryCount, setInventoryCount] = useState(0)

    useEffect(() => {
        fetchInventory()
    }, [])

    const fetchInventory = async () => {
        const { count, error } = await supabase.from('books').select('*', { count: 'exact', head: true })
        if (!error && count !== null) setInventoryCount(count)
    }

    // J'ai basculé de Google Books vers OpenLibrary car Google mettait des bâtons dans les roues sans "vraie" clé API payante
    const searchOpenLibrary = async () => {
        if (!isbn) return
        setLoading(true)
        const cleanIsbn = isbn.replace(/[- ]/g, '')
        try {
            const res = await fetch(`https://openlibrary.org/search.json?q=${cleanIsbn}`)
            const data = await res.json()

            if (data.docs && data.docs.length > 0) {
                const book = data.docs[0]
                setBookData({
                    title: book.title || '',
                    author: book.author_name ? book.author_name.join(', ') : '',
                    synopsis: '', // OpenLibrary donne rarement de longs résumés, on laisse la personne le taper si besoin
                    cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : '',
                    is_available: true
                })
                console.log("Auto-fill réussi grâce à l'API OpenLibrary (Gratuite & sans limite) !")
            } else {
                alert("Livre introuvable via l'ISBN. Pas de panique, tu peux remplir les champs manuellement en dessous.")
            }
        } catch (e) {
            console.error(e)
            alert("Erreur réseau lors de la recherche.")
        }
        setLoading(false)
    }

    const saveToDatabase = async () => {
        setLoading(true)
        const { data, error } = await supabase.from('books').insert([
            {
                title: bookData.title,
                author: bookData.author,
                synopsis: bookData.synopsis,
                cover_url: bookData.cover_url,
                isbn: isbn || null
            }
        ])

        if (error) {
            console.error(error)
            alert("Aïe, erreur lors de la sauvegarde : " + error.message)
        } else {
            alert("Livre ajouté avec succès au catalogue !")
            setBookData({ title: '', author: '', synopsis: '', cover_url: '' })
            setIsbn('')
            fetchInventory()
        }
        setLoading(false)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Panneau d'Administration</h1>
                    <p className="text-muted-foreground mt-1">Ajoutez vos livres via scan rapide API ou au clavier.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2 shadow-sm border-indigo-100">
                    <CardHeader className="bg-indigo-50/50 rounded-t-xl pb-6">
                        <CardTitle>Ajouter un Ouvrage</CardTitle>
                        <CardDescription>Flux Hybride: Entrez un code ISBN pour auto-remplir la fiche.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">

                        <div className="flex space-x-2">
                            <Input
                                className="font-mono"
                                placeholder="Code ISBN (ex: 9782070412811)"
                                value={isbn}
                                onChange={e => setIsbn(e.target.value)}
                            />
                            <Button onClick={searchOpenLibrary} disabled={loading} variant="secondary" className="shadow-sm">
                                {loading ? "Recherche..." : "Aspirer via API"}
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-dashed">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Titre de l'ouvrage</label>
                                <Input value={bookData.title} onChange={e => setBookData({ ...bookData, title: e.target.value })} placeholder="Titre manuel" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Auteur(s)</label>
                                <Input value={bookData.author} onChange={e => setBookData({ ...bookData, author: e.target.value })} placeholder="Auteur manuel" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold">Synopsis / Résumé</label>
                                <textarea
                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                    value={bookData.synopsis}
                                    onChange={e => setBookData({ ...bookData, synopsis: e.target.value })}
                                    placeholder="Tapez ou générez un résumé..."
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end border-t bg-muted/20 px-6 py-4 rounded-b-xl">
                        <Button onClick={saveToDatabase} disabled={loading || !bookData.title} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8">
                            Sauvegarder dans le catalogue
                        </Button>
                    </CardFooter>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Inventaire Total</CardTitle>
                        <CardDescription>Synchronisation directe Supabase</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-7xl font-black text-indigo-600 tracking-tighter">{inventoryCount}</p>
                            <p className="text-xs text-slate-500 mt-3 font-bold uppercase tracking-widest">Ouvrages Hébergés</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
