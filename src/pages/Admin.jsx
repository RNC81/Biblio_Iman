import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'

export default function Admin() {
  const [isbn, setIsbn] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookData, setBookData] = useState({ 
    title: '', author: '', synopsis: '', cover_url: '', 
    status: 'AVAILABLE', private_note: '', 
    language: 'Français', published_date: '', online_url: '' 
  })
  
  const [locationText, setLocationText] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  
  const [allBooks, setAllBooks] = useState([])
  const [editingId, setEditingId] = useState(null)

  // -- V3: Gestions des Catégories Avancées --
  const [dbCategories, setDbCategories] = useState([])
  const [selectedCatIds, setSelectedCatIds] = useState([])

  useEffect(() => {
    fetchInventory()
    fetchCategories()
  }, [])

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('*, locations(shelf), book_categories(category_id, categories(id, name, parent_id))')
      .order('created_at', { ascending: false })
      
    if (!error && data) setAllBooks(data)
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    if (data) setDbCategories(data)
  }

  const handleCreateCategory = async () => {
    const name = window.prompt("1️⃣ Nom de la nouvelle catégorie (ex: Hadith, Fiqh, Histoire) :")
    if (!name) return
    const isSub = window.confirm(`2️⃣ Hiérarchie\nLa catégorie "${name}" appartient-elle à une catégorie parente plus grande ?\n\n- OK = Oui, c'est une sous-catégorie.\n- Annuler = Non, c'est une catégorie Racines.`)
    
    let parent_id = null
    if (isSub) {
       const parentNames = dbCategories.filter(c => !c.parent_id).map(c => c.name).join(', ')
       const parentName = window.prompt(`3️⃣ Quel est le nom EXACT du Parent parmi cette liste ?\n${parentNames}`)
       const parentCat = dbCategories.find(c => c.name.toLowerCase() === parentName?.toLowerCase())
       if (parentCat) parent_id = parentCat.id
       else {
         alert("Erreur: Catégorie parente introuvable ou mal écrite.")
         return
       }
    }
    const { error } = await supabase.from('categories').insert([{ name, parent_id }])
    if (!error) {
      alert(`Catégorie "${name}" créée avec succès !`)
      fetchCategories()
    } else alert("Erreur :" + error.message)
  }

  const toggleCategorySelection = (catId) => {
    setSelectedCatIds(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId])
  }

  // ---

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
          cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : '',
          published_date: book.first_publish_year ? book.first_publish_year.toString() : ''
        })
      } else {
        alert("Livre introuvable via ce code QR/ISBN public.")
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setCoverFile(file)
      setCoverPreview(URL.createObjectURL(file))
    }
  }

  const handleCoverUpload = async () => {
    if (!coverFile) return bookData.cover_url; // S'il n'y a pas d'image custom, on garde celle de l'API (s'il y en a)

    const fileExt = coverFile.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `public/${fileName}`

    const { error: uploadError } = await supabase.storage.from('covers').upload(filePath, coverFile)

    if (uploadError) {
      alert("Erreur réseau pendant l'upload Image : " + uploadError.message)
      return bookData.cover_url
    }

    const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
    return data.publicUrl
  }

  const saveToDatabase = async () => {
    setLoading(true)
    try {
      // 1. Upload Cloud de la couverture Locale
      const finalCoverUrl = await handleCoverUpload()

      // 2. Gestion de l'étagère
      let finalLocationId = null;
      if (locationText.trim()) {
        const { data: locData } = await supabase.from('locations').select('id').eq('shelf', locationText.trim()).single()
        if (locData) finalLocationId = locData.id
        else {
          const { data: newLoc } = await supabase.from('locations').insert([{ shelf: locationText.trim() }]).select().single()
          if (newLoc) finalLocationId = newLoc.id
        }
      }

      // 3. Objet Livre V3 Complet
      let finalBookId = editingId;
      const bp = { 
        title: bookData.title, 
        author: bookData.author, 
        synopsis: bookData.synopsis, 
        isbn: isbn || null, 
        private_note: bookData.private_note || null, 
        location_id: finalLocationId,
        status: bookData.status,
        language: bookData.language,
        published_date: bookData.published_date,
        online_url: bookData.online_url || null,
        cover_url: finalCoverUrl
      }

      // 4. Insertion / Mise à Jour DB
      if (editingId) {
        const { error } = await supabase.from('books').update(bp).eq('id', editingId)
        if (error) throw error
      } else {
        const { data: newBook, error } = await supabase.from('books').insert([bp]).select().single()
        if (error) throw error
        finalBookId = newBook.id;
      }

      // 5. Synchro des tags Catégories depuis les Checkboxes
      if (finalBookId) {
        await supabase.from('book_categories').delete().eq('book_id', finalBookId)
        const relations = selectedCatIds.map(catId => ({ book_id: finalBookId, category_id: catId }))
        if (relations.length > 0) {
          await supabase.from('book_categories').insert(relations)
        }
      }

      alert(editingId ? "Propulsion Cloud : Fiche Mise à Jour ! 🔥" : "Propulsion Cloud : Livre injecté en Base ! 🔥");
      resetForm()
      fetchInventory()
    } catch (err) {
      alert("Erreur fatale Base de données : " + err.message + "\nAssurez-vous d'avoir exécuté la ligne SQL de mise à jour !")
    }
    setLoading(false)
  }

  const resetForm = () => {
    setBookData({ 
      title: '', author: '', synopsis: '', cover_url: '', 
      status: 'AVAILABLE', private_note: '', 
      language: 'Français', published_date: '', online_url: '' 
    })
    setIsbn('')
    setLocationText('')
    setCoverFile(null)
    setCoverPreview(null)
    setSelectedCatIds([])
    setEditingId(null)
  }

  const handleEditClick = (book) => {
    setEditingId(book.id)
    setIsbn(book.isbn || '')
    setLocationText(book.locations ? book.locations.shelf : '')
    
    // Reverse Mapping des catégories enregistrées
    const sCatIds = book.book_categories ? book.book_categories.map(bc => bc.category_id) : []
    setSelectedCatIds(sCatIds)

    setCoverPreview(book.cover_url || null)
    setCoverFile(null)

    setBookData({
      title: book.title, 
      author: book.author || '', 
      synopsis: book.synopsis || '', 
      cover_url: book.cover_url || '', 
      status: book.status || 'AVAILABLE', 
      private_note: book.private_note || '',
      language: book.language || 'Français',
      published_date: book.published_date || '',
      online_url: book.online_url || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (window.confirm("Bouton Rouge ! Es-tu sûr de vaporiser l'intégralité des données de cet ouvrage ?")) {
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (!error) fetchInventory()
    }
  }

  // Permet de mapper le statut visuellement dans la liste
  const getStatusBadge = (status) => {
    if(status === 'AVAILABLE') return <Badge className="bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-all border-transparent text-white font-bold cursor-default">● Sur Étagère</Badge>
    if(status === 'ONLINE') return <Badge className="bg-blue-500 hover:bg-blue-600 shadow-sm transition-all border-transparent text-white font-bold cursor-default">🌐 Fichier Digital</Badge>
    if(status === 'BORROWED') return <Badge className="bg-rose-500 hover:bg-rose-600 shadow-sm px-4 transition-all border-transparent text-white font-bold cursor-default">○ Prêté</Badge>
    // Safe fallback if SQL migration hasn't fully worked locally
    return <Badge className="bg-emerald-500">AVAILABLE</Badge> 
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Architecture Logistique <span className="text-indigo-600 ml-2">V3</span></h1>
          <p className="text-slate-500 mt-1 font-medium">Contrôlez les codes QR, Hébergez des couvertures et Gérez l'arbre des thématiques.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr]">
        {/* COLONNE GAUCHE : L'USINE À GAZ (FORMULAIRE V3) */}
        <div className="space-y-6 lg:sticky lg:top-24 h-fit max-h-[85vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
          <Card className={`shadow-xl transition-all duration-300 ${editingId ? 'border-amber-400 bg-amber-50/20 ring-4 ring-amber-100' : 'border-indigo-100/50'}`}>
            <CardHeader className={`${editingId ? 'bg-gradient-to-br from-amber-100 to-amber-50' : 'bg-gradient-to-br from-indigo-50 to-white'} rounded-t-xl pb-4 border-b border-black/5`}>
              <div className="flex justify-between items-center mb-1">
                <CardTitle className={editingId ? "text-amber-900" : "text-slate-900"}>{editingId ? "Mutation DB" : "Inscrire un Ouvrage"}</CardTitle>
                {editingId && <Badge variant="outline" className="bg-amber-200 text-amber-800 border-amber-400 font-bold">Terminal Édition</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5 bg-white/50 backdrop-blur-sm">
              
              {!editingId && (
                <div className="flex items-center space-x-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                  <span className="text-xl pl-2">📷</span>
                  <Input className="font-mono text-sm bg-white shadow-inner" placeholder="Taper / Scanner Référence" value={isbn} onChange={e => setIsbn(e.target.value)} />
                  <Button onClick={searchOpenLibrary} disabled={loading} variant="default" className="shadow-sm font-bold bg-indigo-600">Aspirer API</Button>
                </div>
              )}

              <div className="space-y-5 pt-2">
                
                {/* BLOC : Titre & Auteur */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Titre & Auteur</label>
                    <Input value={bookData.title} onChange={e => setBookData({...bookData, title: e.target.value})} placeholder="Ex: Tafsir Al-Mizan..." className="bg-white font-bold text-slate-800" />
                  </div>
                  <Input value={bookData.author} onChange={e => setBookData({...bookData, author: e.target.value})} placeholder="Allamah Tabatabai" className="bg-white" />
                </div>

                {/* NOUVEAU BLOC : Détails (Date, Langue) */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 shadow-inner">
                  <div className="space-y-1">
                     <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Édition / Année</label>
                     <Input value={bookData.published_date} onChange={e => setBookData({...bookData, published_date: e.target.value})} placeholder="Ex: 1985 / 1405 AH" className="bg-white text-xs h-9" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Langue</label>
                     <select 
                       className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                       value={bookData.language}
                       onChange={e => setBookData({...bookData, language: e.target.value})}
                     >
                       <option value="Français">Français</option>
                       <option value="Arabe">Arabe</option>
                       <option value="Anglais">Anglais</option>
                       <option value="Farsi">Farsi</option>
                       <option value="Multi-langues">Multi-langues</option>
                     </select>
                  </div>
                </div>

                {/* NOUVEAU BLOC : Couverture Custom Storage */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Hébergement Couverture (Optionnel)</label>
                  <div className="flex items-center space-x-3">
                    <div className="h-14 w-11 bg-slate-100 border border-slate-200 rounded overflow-hidden flex-shrink-0">
                       {coverPreview ? <img src={coverPreview} className="object-cover w-full h-full" alt="Prévisualisation" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">Aucune</div>}
                    </div>
                    <Input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} className="bg-white text-xs py-1.5 h-auto cursor-pointer" />
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium">Surcharge l'image API si fichier fourni.</p>
                </div>

                {/* NOUVEAU BLOC : Sélecteur de Statuts EXACTS (Enum V3) */}
                <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-white shadow-sm ring-1 ring-black/5">
                   <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Signal d'État Actuel</label>
                   <div className="grid grid-cols-3 gap-2 mt-1">
                     <button onClick={() => setBookData({...bookData, status: 'AVAILABLE'})} className={`py-2 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${bookData.status === 'AVAILABLE' ? 'bg-emerald-500 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        <span>📚</span><span>Rayon</span>
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'ONLINE'})} className={`py-2 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${bookData.status === 'ONLINE' ? 'bg-blue-500 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        <span>🌐</span><span>Digital</span>
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'BORROWED'})} className={`py-2 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${bookData.status === 'BORROWED' ? 'bg-rose-500 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        <span>🔒</span><span>Pris</span>
                     </button>
                   </div>
                   
                   {bookData.status === 'ONLINE' && (
                     <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                       <Input value={bookData.online_url} onChange={e => setBookData({...bookData, online_url: e.target.value})} placeholder="Lien HTTP (Drive, PDF...)" className="bg-blue-50/50 border-blue-200 text-blue-900 text-xs h-9" />
                     </div>
                   )}
                </div>

                {/* NOUVEAU BLOC : Le Constructeur de Catégories Interactif */}
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center">
                      Topologie & Tags
                    </label>
                    <Button variant="outline" size="sm" onClick={handleCreateCategory} className="text-[9px] h-6 px-2 bg-indigo-50 border-indigo-200 text-indigo-700">
                      + Créer un Tag DB
                    </Button>
                  </div>
                  
                  {/* Select Etagère Rapide */}
                  <div className="flex space-x-2 items-center">
                    <span className="text-lg">📍</span>
                    <Input value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="Emplacement Physique (ex: Salle C)" className="bg-white h-9" />
                  </div>

                  {/* Arbre Catégories Cloud */}
                  <div className="min-h-[60px] p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-1.5 shadow-inner">
                     {dbCategories.length === 0 ? <span className="text-xs text-slate-400 p-2 italic">Aucune catégorie en BDD...</span> : 
                        dbCategories.map(cat => {
                          const isSel = selectedCatIds.includes(cat.id)
                          const isSub = !!cat.parent_id
                          return (
                            <Badge 
                               key={cat.id} 
                               variant="outline"
                               onClick={() => toggleCategorySelection(cat.id)}
                               className={`cursor-pointer transition-all select-none ${isSel ? 'bg-indigo-600 text-white border-transparent shadow shadow-indigo-200/50' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'} ${isSub ? 'border-dashed opacity-90' : ''}`}
                            >
                               {isSel && <span className="mr-1">✓</span>} {isSub && <span className="text-[8px] mr-1 opacity-70">↳</span>} {cat.name}
                            </Badge>
                          )
                        })
                     }
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Résumé Intégral</label>
                  <textarea 
                    className="flex min-h-[90px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-y"
                    value={bookData.synopsis} 
                    onChange={e => setBookData({...bookData, synopsis: e.target.value})} 
                    placeholder="Il était une fois..."
                  />
                </div>

                <div className="space-y-1.5 mt-4 p-3 bg-amber-50/30 border border-amber-200/50 shadow-inner rounded-xl group transition-all">
                  <label className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center mb-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                     Mouchard Admin (Optionnel)
                  </label>
                  <textarea 
                    className="flex min-h-[50px] w-full rounded-md border border-amber-100 bg-white px-2.5 py-2 text-xs shadow-sm placeholder:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 resize-y font-medium text-slate-700"
                    value={bookData.private_note} 
                    onChange={e => setBookData({...bookData, private_note: e.target.value})} 
                    placeholder="Ex: Prêté au professeur X. / Couverture abîmée..."
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t bg-slate-50/80 px-6 py-5 rounded-b-xl z-20 sticky bottom-0">
              {editingId ? (
                <>
                  <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-amber-500 hover:bg-amber-600 font-bold text-white shadow-md shadow-amber-200">
                    {loading ? "Synchronisation AWS..." : "Écraser en Production"}
                  </Button>
                  <Button variant="ghost" onClick={resetForm} disabled={loading} className="w-full text-slate-500 hover:text-slate-800 h-8">
                    Annuler l'opération
                  </Button>
                </>
              ) : (
                <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-slate-900 hover:bg-indigo-600 transition-colors font-bold text-white shadow-lg py-6 text-lg">
                  {loading ? "Injection Cloud..." : "🚀 Injecter au Catalogue"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        
        {/* COLONNE DROITE : MURET DE L'INVENTAIRE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-200">
            <h2 className="text-xl font-extrabold flex items-center space-x-3 text-slate-800">
              <span>Data Center</span> 
              <Badge variant="secondary" className="font-mono bg-indigo-100 text-indigo-700 text-sm px-3 shadow-inner">{allBooks.length}</Badge>
            </h2>
            <Button onClick={fetchInventory} variant="outline" size="sm" className="bg-white"><span className="text-xs">🔄 Refresh DB</span></Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {allBooks.length === 0 ? (
               <div className="col-span-full py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl flex flex-col items-center justify-center font-medium shadow-sm">
                 <span className="text-4xl mb-4 opacity-50">📂</span>
                 Aucun Node référencé. La DB est vide.
               </div>
            ) : (
              allBooks.map(book => (
                <Card key={book.id} className="shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
                  <div className="h-44 w-full bg-slate-100/80 flex items-center justify-center overflow-hidden border-b border-black/5 relative p-4">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-90 group-hover:scale-110 transition-transform duration-700 rounded-sm shadow-md" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-4xl mb-2 opacity-20">📖</span>
                        <span className="text-slate-400 font-bold text-sm select-none px-4 text-center leading-tight">{book.title.substring(0,35)}</span>
                      </div>
                    )}
                    
                    {/* Le Badge Statut Direct */}
                    <div className="absolute top-3 left-3 shadow-xl backdrop-blur-md rounded transition-all group-hover:scale-105">
                       {getStatusBadge(book.status)}
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2 p-4 bg-white z-10 relative">
                    <CardTitle className="text-base font-bold line-clamp-2 leading-tight text-slate-900" title={book.title}>{book.title}</CardTitle>
                    <div className="flex justify-between items-center mt-1">
                      <CardDescription className="text-xs truncate font-semibold text-indigo-600 uppercase tracking-wider">{book.author || "Auteur Inconnu"}</CardDescription>
                      <span className="text-[10px] text-slate-400 font-mono">{book.published_date}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-50">
                       {book.language && <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-500 border-slate-200">🗣️ {book.language}</Badge>}
                       {book.locations && <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-700 font-bold">📍 {book.locations.shelf}</Badge>}
                       {book.book_categories && book.book_categories.map(bc => (
                          <Badge variant="secondary" key={bc.category_id} className="text-[9px] bg-indigo-50 text-indigo-700 font-bold"># {bc.categories?.name}</Badge>
                       ))}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-0 text-[11px] bg-white space-y-1">
                     {book.status === 'ONLINE' && book.online_url && (
                        <div className="p-1.5 mb-2 bg-blue-50 border border-blue-100 rounded text-blue-800 line-clamp-1">
                          🔗 <a href={book.online_url} target="_blank" rel="noreferrer" className="underline font-mono ml-1">{book.online_url}</a>
                        </div>
                     )}
                     {book.private_note && (
                       <div className="bg-amber-50/50 border border-amber-100 rounded p-2 mb-2">
                         <p className="line-clamp-2 text-amber-900 font-medium leading-tight">
                           <span className="font-extrabold mr-1">🔐 Suivi:</span> 
                           {book.private_note}
                         </p>
                       </div>
                     )}
                  </CardContent>

                  <CardFooter className="p-3 flex justify-between space-x-2 border-t border-slate-100 bg-slate-50/80 relative z-10 w-full mt-auto">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(book)} className="text-xs font-bold px-4 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white flex-1 transition-colors shadow-sm">
                      🖋️ Éditer Node
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(book.id)} className="h-8 w-8 text-rose-400 hover:text-white hover:bg-rose-500 transition-colors shadow-sm" title="Vaporiser BDD">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
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
