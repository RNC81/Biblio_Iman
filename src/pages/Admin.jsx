import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'

export default function Admin() {
  const [isbn, setIsbn] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookData, setBookData] = useState({ title: '', author: '', synopsis: '', cover_url: '', is_available: true })
  
  const [allBooks, setAllBooks] = useState([])
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false })
    if (!error && data) setAllBooks(data)
  }

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
          ...bookData,
          title: book.title || '',
          author: book.author_name ? book.author_name.join(', ') : '',
          cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : ''
        })
      } else {
        alert("Livre introuvable via l'ISBN. Remplis manuellement.")
      }
    } catch (e) {
      console.error(e)
      alert("Erreur réseau requete ISBN.")
    }
    setLoading(false)
  }

  const saveToDatabase = async () => {
    setLoading(true)
    if (editingId) {
      const { error } = await supabase
        .from('books')
        .update({ title: bookData.title, author: bookData.author, synopsis: bookData.synopsis, isbn: isbn || null })
        .eq('id', editingId)

      if (error) alert("Erreur MAJ : " + error.message)
      else {
        alert("Ouvrage mis à jour avec succès !")
        resetForm()
        fetchInventory()
      }
    } else {
      const { error } = await supabase.from('books').insert([{ 
        title: bookData.title, author: bookData.author, synopsis: bookData.synopsis, cover_url: bookData.cover_url, isbn: isbn || null
      }])

      if (error) alert("Erreur d'ajout : " + error.message)
      else {
        alert("Nouveau livre ajouté dans l'armurerie !")
        resetForm()
        fetchInventory()
      }
    }
    setLoading(false)
  }

  const resetForm = () => {
    setBookData({ title: '', author: '', synopsis: '', cover_url: '', is_available: true })
    setIsbn('')
    setEditingId(null)
  }

  const handleEditClick = (book) => {
    setEditingId(book.id)
    setIsbn(book.isbn || '')
    setBookData({
      title: book.title, author: book.author || '', synopsis: book.synopsis || '', cover_url: book.cover_url || '', is_available: book.is_available
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (window.confirm("Action Irréversible ! Es-tu certain de vouloir supprimer cet ouvrage définitivement du catalogue ?")) {
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (!error) fetchInventory()
    }
  }

  const handleToggleStatus = async (book) => {
    const { error } = await supabase.from('books').update({ is_available: !book.is_available }).eq('id', book.id)
    if (!error) fetchInventory()
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Générateur & Inventaire</h1>
        <p className="text-slate-500 mt-1 font-medium">Contrôlez l'intégralité du cycle de vie du catalogue.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 xl:grid-cols-4">
        {/* Colonne Formulaire (Sticky sur Desktop pour le confort) */}
        <div className="lg:col-span-1 xl:col-span-1 space-y-6 lg:sticky lg:top-24 h-fit">
          <Card className={`shadow-xl transition-all duration-300 ${editingId ? 'border-amber-400 bg-amber-50/20 ring-4 ring-amber-100' : 'border-indigo-100/50'}`}>
            <CardHeader className={`${editingId ? 'bg-gradient-to-br from-amber-100 to-amber-50' : 'bg-gradient-to-br from-indigo-50 to-white'} rounded-t-xl pb-6 border-b border-black/5`}>
              <div className="flex justify-between items-center mb-2">
                <CardTitle className={editingId ? "text-amber-900" : "text-slate-900"}>{editingId ? "Éditeur" : "Nouveau Livre"}</CardTitle>
                {editingId && <Badge variant="outline" className="bg-amber-200 text-amber-800 border-amber-400 font-bold">Modification</Badge>}
              </div>
              <CardDescription className="font-medium text-xs">
                {editingId ? "Les modifications écraseront la base de données publique." : "Remplissez le manuel ou utilisez l'OpenAPI."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 bg-white/50 backdrop-blur-sm">
              
              {!editingId && (
                <div className="flex space-x-2">
                  <Input className="font-mono text-sm bg-white" placeholder="ISBN (ex: 9780..)" value={isbn} onChange={e => setIsbn(e.target.value)} />
                  <Button onClick={searchOpenLibrary} disabled={loading} variant="secondary" className="shadow-sm font-semibold">API</Button>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titre Officiel</label>
                  <Input value={bookData.title} onChange={e => setBookData({...bookData, title: e.target.value})} placeholder="Titre de l'ouvrage" className="bg-white font-medium" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Auteur(s)</label>
                  <Input value={bookData.author} onChange={e => setBookData({...bookData, author: e.target.value})} placeholder="Al-Mufid, Tabari..." className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Synopsis Court</label>
                  <textarea 
                    className="flex min-h-[140px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-y"
                    value={bookData.synopsis} 
                    onChange={e => setBookData({...bookData, synopsis: e.target.value})} 
                    placeholder="Enseignements principaux de cette version..."
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t bg-white px-6 py-5 rounded-b-xl">
              {editingId ? (
                <>
                  <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-amber-500 hover:bg-amber-600 font-bold text-white shadow-md shadow-amber-200">
                    Propulser la mise à jour
                  </Button>
                  <Button variant="ghost" onClick={resetForm} disabled={loading} className="w-full text-slate-500 hover:text-slate-800">
                    Annuler l'édition
                  </Button>
                </>
              ) : (
                <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-slate-900 hover:bg-indigo-600 transition-colors font-bold text-white shadow-lg">
                  Valider et Exposer
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        
        {/* Colonne Liste de l'inventaire en temps réel */}
        <div className="lg:col-span-2 xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-slate-100">
            <h2 className="text-xl font-extrabold flex items-center space-x-3 text-slate-800">
              <span>Inventaire Global</span> 
              <Badge variant="secondary" className="font-mono bg-indigo-100 text-indigo-700 text-sm px-3">{allBooks.length}</Badge>
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {allBooks.length === 0 ? (
               <div className="col-span-full py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl flex items-center justify-center font-medium">
                 Aucun livre référencé dans l'architecture.
               </div>
            ) : (
              allBooks.map(book => (
                <Card key={book.id} className="shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
                  <div className="h-40 w-full bg-slate-50 flex items-center justify-center overflow-hidden border-b relative">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-90 group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <span className="text-slate-300 font-bold text-lg select-none px-4 text-center">{book.title.substring(0,25)}</span>
                    )}
                    <Badge 
                        variant="outline" 
                        className={`absolute top-3 left-3 shadow-lg cursor-pointer backdrop-blur-md font-bold transition-all hover:scale-105 active:scale-95 ${book.is_available ? 'bg-emerald-500/90 text-white border-transparent' : 'bg-rose-500/90 text-white border-transparent'}`}
                        onClick={() => handleToggleStatus(book)}
                        title="Inverser le statut d'emprunt"
                    >
                        {book.is_available ? "● Sur Étagère" : "○ Lu"}
                    </Badge>
                  </div>
                  <CardHeader className="pb-3 p-5 bg-white z-10 relative">
                    <CardTitle className="text-base font-bold line-clamp-2 leading-tight text-slate-900">{book.title}</CardTitle>
                    <CardDescription className="text-xs truncate font-medium text-slate-500 mt-1">{book.author || "Auteur Géré"}</CardDescription>
                  </CardHeader>
                  <CardFooter className="p-4 pt-3 flex justify-between space-x-2 border-t bg-slate-50 relative z-10 w-full">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(book)} className="text-xs font-semibold px-4 border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex-1">Éditer Fiche</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(book.id)} className="h-9 w-9 text-rose-400 hover:text-white hover:bg-rose-500 transition-colors" title="Raser de la BDD">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
