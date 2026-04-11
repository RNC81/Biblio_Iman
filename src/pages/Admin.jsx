import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'

export default function Admin() {
  const [isbn, setIsbn] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookData, setBookData] = useState({ title: '', author: '', synopsis: '', cover_url: '', is_available: true, private_note: '' })
  const [categoriesText, setCategoriesText] = useState('')
  const [locationText, setLocationText] = useState('')
  
  const [allBooks, setAllBooks] = useState([])
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    // La requête asynchrone absolue : ramener les tables liées (jointure SQL) 
    const { data, error } = await supabase
      .from('books')
      .select('*, locations(shelf), book_categories(categories(name))')
      .order('created_at', { ascending: false })
      
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
    
    try {
      // 1. LA LOGIQUE D'EMPLACEMENT (Find or Create)
      let finalLocationId = null;
      if (locationText.trim()) {
        const { data: locData } = await supabase.from('locations').select('id').eq('shelf', locationText.trim()).single()
        if (locData) finalLocationId = locData.id
        else {
          const { data: newLoc } = await supabase.from('locations').insert([{ shelf: locationText.trim() }]).select().single()
          if (newLoc) finalLocationId = newLoc.id
        }
      }

      // 2. L'ENREGISTREMENT DU LIVRE (Update ou Create)
      let finalBookId = editingId;
      const bp = { 
        title: bookData.title, author: bookData.author, synopsis: bookData.synopsis, 
        isbn: isbn || null, private_note: bookData.private_note || null, location_id: finalLocationId
      }

      if (editingId) {
        const { error } = await supabase.from('books').update(bp).eq('id', editingId)
        if (error) throw error
      } else {
        bp.cover_url = bookData.cover_url;
        const { data: newBook, error } = await supabase.from('books').insert([bp]).select().single()
        if (error) throw error
        finalBookId = newBook.id;
      }

      // 3. LA LOGIQUE DES CATÉGORIES (Suppression des vieilles relations puis re-création)
      if (finalBookId) {
        await supabase.from('book_categories').delete().eq('book_id', finalBookId)
        
        const cats = categoriesText.split(',').map(c => c.trim()).filter(c => c)
        for (const catName of cats) {
          let catId = null;
          const { data: catData } = await supabase.from('categories').select('id').eq('name', catName).single()
          if (catData) catId = catData.id;
          else {
            const { data: newCat } = await supabase.from('categories').insert([{ name: catName }]).select().single()
            if (newCat) catId = newCat.id;
          }
          if (catId) await supabase.from('book_categories').insert([{ book_id: finalBookId, category_id: catId }])
        }
      }
      alert(editingId ? "Mise à jour réussie avec les nouveaux paramètres !" : "Nouveau livre ajouté avec l'étiquette !");
      resetForm()
      fetchInventory()
    } catch (err) {
      alert("Erreur Serveur : " + err.message)
    }
    setLoading(false)
  }

  const resetForm = () => {
    setBookData({ title: '', author: '', synopsis: '', cover_url: '', is_available: true, private_note: '' })
    setIsbn('')
    setCategoriesText('')
    setLocationText('')
    setEditingId(null)
  }

  const handleEditClick = (book) => {
    setEditingId(book.id)
    setIsbn(book.isbn || '')
    
    // On extrait les relations Supabase du JSON et on les remet en format texte lisible "Cat 1, Cat 2"
    const cats = book.book_categories ? book.book_categories.map(bc => bc.categories.name).join(', ') : ''
    setCategoriesText(cats)
    setLocationText(book.locations ? book.locations.shelf : '')

    setBookData({
      title: book.title, author: book.author || '', synopsis: book.synopsis || '', cover_url: book.cover_url || '', is_available: book.is_available, private_note: book.private_note || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (window.confirm("Action Irréversible ! Es-tu certain de vouloir écraser ce titre des archives ?")) {
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
        <p className="text-slate-500 mt-1 font-medium">Contrôlez l'intégralité du cycle de vie du catalogue et des emprunts.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 xl:grid-cols-4">
        {/* Colonne Formulaire Inteligent (Sticky) */}
        <div className="lg:col-span-1 xl:col-span-1 space-y-6 lg:sticky lg:top-24 h-fit">
          <Card className={`shadow-xl transition-all duration-300 ${editingId ? 'border-amber-400 bg-amber-50/20 ring-4 ring-amber-100' : 'border-indigo-100/50'}`}>
            <CardHeader className={`${editingId ? 'bg-gradient-to-br from-amber-100 to-amber-50' : 'bg-gradient-to-br from-indigo-50 to-white'} rounded-t-xl pb-6 border-b border-black/5`}>
              <div className="flex justify-between items-center mb-2">
                <CardTitle className={editingId ? "text-amber-900" : "text-slate-900"}>{editingId ? "Éditeur Actif" : "Nouveau Fichier"}</CardTitle>
                {editingId && <Badge variant="outline" className="bg-amber-200 text-amber-800 border-amber-400 font-bold">Modification</Badge>}
              </div>
              <CardDescription className="font-medium text-xs">
                {editingId ? "Les modifications se répercutent en temps réel sur Vercel." : "Cataloguez intelligemment l'inventaire physique."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 bg-white/50 backdrop-blur-sm">
              
              {!editingId && (
                <div className="flex space-x-2">
                  <Input className="font-mono text-sm bg-white" placeholder="ISBN (Scan)" value={isbn} onChange={e => setIsbn(e.target.value)} />
                  <Button onClick={searchOpenLibrary} disabled={loading} variant="secondary" className="shadow-sm font-semibold hover:bg-slate-200">API Lock</Button>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titre Officiel</label>
                  <Input value={bookData.title} onChange={e => setBookData({...bookData, title: e.target.value})} placeholder="Titre de l'ouvrage" className="bg-white font-medium" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Auteur(s)</label>
                  <Input value={bookData.author} onChange={e => setBookData({...bookData, author: e.target.value})} placeholder="Ex: Al-Mufid, Tabari..." className="bg-white" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Catégories</label>
                     <Input value={categoriesText} onChange={e => setCategoriesText(e.target.value)} placeholder="Fiqh, Histoire..." className="bg-white text-xs" title="Séparez par une virgule" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Armoire</label>
                     <Input value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="Étagère A2" className="bg-white text-xs" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Synopsis du Lancement</label>
                  <textarea 
                    className="flex min-h-[90px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-y"
                    value={bookData.synopsis} 
                    onChange={e => setBookData({...bookData, synopsis: e.target.value})} 
                    placeholder="Enseignements clés de la thèse..."
                  />
                </div>

                {/* LA FAMEUSE NOTE PRIVÉE POUR TRAQUER LES EMPRUNTEURS */}
                <div className="space-y-1.5 mt-4 p-3 bg-slate-50 border border-slate-200 shadow-inner rounded-xl group hover:border-indigo-200 transition-colors">
                  <label className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest flex items-center mb-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                     Note & Emprunteur (Livre Sécurisé)
                  </label>
                  <textarea 
                    className="flex min-h-[70px] w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-y font-medium text-slate-700"
                    value={bookData.private_note} 
                    onChange={e => setBookData({...bookData, private_note: e.target.value})} 
                    placeholder="Prêté à l'étudiant Youssef le 12/04. Numéro de tel: 06..."
                  />
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight mt-2 flex justify-end">Ce champ restera occulte.</p>
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
              <span>Muret de l'Inventaire</span> 
              <Badge variant="secondary" className="font-mono bg-indigo-100 text-indigo-700 text-sm px-3 shadow-inner">{allBooks.length}</Badge>
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {allBooks.length === 0 ? (
               <div className="col-span-full py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl flex items-center justify-center font-medium shadow-sm">
                 Acquisition de la bibliothèque vierge. Insérez le premier livre !
               </div>
            ) : (
              allBooks.map(book => (
                <Card key={book.id} className="shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
                  <div className="h-44 w-full bg-slate-100/50 flex items-center justify-center overflow-hidden border-b relative">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-95 group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <span className="text-slate-300 font-bold text-lg select-none px-4 text-center">{book.title.substring(0,25)}</span>
                    )}
                    <Badge 
                        variant="outline" 
                        className={`absolute top-3 left-3 shadow-xl cursor-pointer backdrop-blur-md font-bold transition-all hover:scale-105 active:scale-95 ${book.is_available ? 'bg-emerald-500/90 text-white border-transparent' : 'bg-rose-500/90 text-white border-transparent'}`}
                        onClick={() => handleToggleStatus(book)}
                        title="Inverser le statut d'emprunt"
                    >
                        {book.is_available ? "● Sur Étagère" : "○ Lu"}
                    </Badge>
                  </div>
                  <CardHeader className="pb-3 p-5 bg-white z-10 relative">
                    <CardTitle className="text-lg font-bold line-clamp-2 leading-tight text-slate-900">{book.title}</CardTitle>
                    <CardDescription className="text-xs truncate font-semibold text-indigo-600 mt-1 uppercase tracking-wider">{book.author || "Auteur Géré"}</CardDescription>
                    
                    {/* TOPOLOGIE VUE RAPIDE */}
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-50">
                       {book.locations && <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2">📍 {book.locations.shelf}</Badge>}
                       {book.book_categories && book.book_categories.map(bc => (
                          <Badge variant="secondary" key={bc.categories.name} className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2"># {bc.categories.name}</Badge>
                       ))}
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 pb-0 text-xs text-slate-400 bg-white py-3 space-y-1">
                     {book.private_note ? (
                       <div className="bg-amber-50/50 border border-amber-100 rounded p-2.5">
                         <p className="line-clamp-2 text-amber-900 font-medium"><span className="font-extrabold mr-1">🔐</span> {book.private_note}</p>
                       </div>
                     ) : (
                       <div className="p-2.5 opacity-0 pointer-events-none hidden"><p>Vide</p></div> // Placeholder design
                     )}
                  </CardContent>

                  <CardFooter className="p-4 flex justify-between space-x-2 border-t border-slate-100 bg-slate-50/50 relative z-10 w-full mt-auto">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(book)} className="text-xs font-bold px-4 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white flex-1 transition-colors">Éditer Fiche</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(book.id)} className="h-9 w-9 text-rose-400 hover:text-white hover:bg-rose-500 transition-colors shadow-sm" title="Raser de la BDD">
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
