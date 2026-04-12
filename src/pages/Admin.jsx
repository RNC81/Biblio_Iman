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
  
  // States du Module Inline de création de catégorie
  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatParentId, setNewCatParentId] = useState('')

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
    if (!newCatName.trim()) return;
    const parent_id = newCatParentId === '' ? null : newCatParentId;
    
    // Check duplication
    const exists = dbCategories.find(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())
    if (exists) {
      alert("Cette catégorie existe déjà !")
      return;
    }

    const { error } = await supabase.from('categories').insert([{ name: newCatName.trim(), parent_id }])
    if (!error) {
       setNewCatName('')
       setNewCatParentId('')
       fetchCategories()
    } else alert("Erreur BDD :" + error.message)
  }

  const toggleCategorySelection = (catId) => {
    setSelectedCatIds(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId])
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
      // Protection native limite à ~5Mo pour du Web classique
      if (file.size > 5 * 1024 * 1024) {
        alert("L'image est trop lourde. Maximum 5 Mo recommandés.")
        return;
      }
      setCoverFile(file)
      setCoverPreview(URL.createObjectURL(file))
    }
  }

  const handleCoverUpload = async () => {
    if (!coverFile) return bookData.cover_url; 

    // Hashage du nom pour éviter les remplacements indésirables par les mêmes noms de fichier
    const fileExt = coverFile.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `public/${fileName}`

    const { error: uploadError } = await supabase.storage.from('covers').upload(filePath, coverFile)

    if (uploadError) {
      alert("Erreur upload Storage (Avez-vous bien mis la policy RLS ?) : " + uploadError.message)
      return bookData.cover_url
    }

    const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
    return data.publicUrl
  }

  const saveToDatabase = async () => {
    setLoading(true)
    try {
      const finalCoverUrl = await handleCoverUpload()

      let finalLocationId = null;
      if (locationText.trim()) {
        const { data: locData } = await supabase.from('locations').select('id').eq('shelf', locationText.trim()).single()
        if (locData) finalLocationId = locData.id
        else {
          const { data: newLoc } = await supabase.from('locations').insert([{ shelf: locationText.trim() }]).select().single()
          if (newLoc) finalLocationId = newLoc.id
        }
      }

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

      if (editingId) {
        const { error } = await supabase.from('books').update(bp).eq('id', editingId)
        if (error) throw error
      } else {
        const { data: newBook, error } = await supabase.from('books').insert([bp]).select().single()
        if (error) throw error
        finalBookId = newBook.id;
      }

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
      alert("Erreur fatale Base de données : " + err.message + "\nAssurez-vous d'avoir exécuté TOUTE la ligne SQL de mise à jour !")
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
    setShowCatManager(false)
    setEditingId(null)
  }

  const handleEditClick = (book) => {
    setEditingId(book.id)
    setIsbn(book.isbn || '')
    setLocationText(book.locations ? book.locations.shelf : '')
    
    const sCatIds = book.book_categories ? book.book_categories.map(bc => bc.category_id) : []
    setSelectedCatIds(sCatIds)

    setCoverPreview(book.cover_url || null)
    setCoverFile(null)
    setShowCatManager(false)

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

  // Permet de mapper le statut visuellement dans la liste de droite
  const getStatusBadge = (status) => {
    if(status === 'AVAILABLE') return <Badge className="bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all border-emerald-800 text-white font-bold cursor-default tracking-widest uppercase text-[10px]">Sur Étagère</Badge>
    if(status === 'ONLINE') return <Badge className="bg-blue-600 hover:bg-blue-700 shadow-sm transition-all border-blue-800 text-white font-bold cursor-default tracking-widest uppercase text-[10px]">Digital</Badge>
    if(status === 'BORROWED') return <Badge className="bg-slate-600 hover:bg-slate-700 shadow-sm px-4 transition-all border-slate-800 text-white font-bold cursor-default tracking-widest uppercase text-[10px]">Prêté</Badge>
    return <Badge className="bg-emerald-500">AVAILABLE</Badge> 
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Architecture Logistique <span className="text-indigo-600 ml-2">V3.1</span></h1>
          <p className="text-slate-500 mt-1 font-medium">Contrôlez les codes QR, hébergez les données et supervisez les emprunts administratifs.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr]">
        
        {/* COLONNE GAUCHE MAXIMISÉE : FORMULAIRE V3 */}
        <div className="space-y-6 lg:sticky lg:top-24 h-fit max-h-[85vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
          <Card className={`shadow-xl transition-all duration-300 border ${editingId ? 'border-amber-400 bg-amber-50/20 ring-4 ring-amber-100' : 'border-slate-200'}`}>
            <CardHeader className={`${editingId ? 'bg-gradient-to-br from-amber-100 to-amber-50' : 'bg-slate-50/80'} rounded-t-xl pb-4 border-b border-black/5`}>
              <div className="flex justify-between items-center mb-1">
                <CardTitle className={editingId ? "text-amber-900" : "text-slate-900"}>{editingId ? "Mutation DB Actuelle" : "Inscrire un Ouvrage"}</CardTitle>
                {editingId && <Badge variant="outline" className="bg-amber-200 text-amber-800 border-amber-400 font-bold">Terminal Édition</Badge>}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-5 pt-5 bg-white backdrop-blur-sm">
              
              {!editingId && (
                <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-xl pl-2">📷</span>
                  <Input className="font-mono text-sm bg-white shadow-inner" placeholder="Pointeur Douchette (ISBN/QR)" value={isbn} onChange={e => setIsbn(e.target.value)} />
                  <Button onClick={searchOpenLibrary} disabled={loading} variant="default" className="shadow-sm font-bold bg-slate-800">AutoFill Hub</Button>
                </div>
              )}

              <div className="space-y-5 pt-2">
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Titre Officiel</label>
                    <Input value={bookData.title} onChange={e => setBookData({...bookData, title: e.target.value})} placeholder="Requis" className="bg-white font-bold text-slate-800" />
                  </div>
                  <Input value={bookData.author} onChange={e => setBookData({...bookData, author: e.target.value})} placeholder="Auteur (Requis)" className="bg-white" />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 shadow-inner">
                  <div className="space-y-1">
                     <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Édition / Date</label>
                     <Input value={bookData.published_date} onChange={e => setBookData({...bookData, published_date: e.target.value})} placeholder="1405" className="bg-white text-xs h-9" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Langue</label>
                     <select 
                       className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                       value={bookData.language}
                       onChange={e => setBookData({...bookData, language: e.target.value})}
                     >
                       <option value="Français">Français</option>
                       <option value="Arabe">Arabe</option>
                       <option value="Anglais">Anglais</option>
                       <option value="Farsi">Farsi</option>
                       <option value="Multi-langues">Multi</option>
                     </select>
                  </div>
                </div>

                {/* MODULE UI PROFESSIONNEL POUR L'UPLOAD D'IMAGE */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Attribution de Couverture (Supabase Cloud)</label>
                  <div className="flex items-center space-x-4">
                    <div className="h-16 w-12 bg-slate-100 border border-slate-200 rounded overflow-hidden flex-shrink-0 shadow-inner">
                       {coverPreview ? <img src={coverPreview} className="object-cover w-full h-full" alt="Preview" /> : <div className="w-full h-full flex flex-col items-center justify-center text-[9px] text-slate-400 font-medium"><span>Vide</span></div>}
                    </div>
                    <div className="flex-1">
                      <Input id="cover-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      <label htmlFor="cover-upload" className="flex items-center justify-center w-full h-9 px-4 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors shadow-sm focus-within:ring-2 focus-within:ring-slate-400">
                        Sélectionner Fichier Image
                      </label>
                      <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">JPG/PNG. Max 5Mo recommandés.</p>
                    </div>
                  </div>
                </div>

                {/* SELECTEUR DE STATUT PROFESSIONNEL (Sans Emojis) */}
                <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-white shadow-sm ring-1 ring-black/5">
                   <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Logistique du support actuel</label>
                   <div className="grid grid-cols-3 gap-2 mt-1 relative z-0">
                     <button onClick={() => setBookData({...bookData, status: 'AVAILABLE'})} className={`py-2 text-[11px] font-bold uppercase tracking-wider rounded border transition-all ${bookData.status === 'AVAILABLE' ? 'bg-emerald-600 text-white border-emerald-700 shadow-md transform scale-105 z-10' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        Disponible
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'ONLINE'})} className={`py-2 text-[11px] font-bold uppercase tracking-wider rounded border transition-all ${bookData.status === 'ONLINE' ? 'bg-blue-600 text-white border-blue-700 shadow-md transform scale-105 z-10' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        En Ligne
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'BORROWED'})} className={`py-2 text-[11px] font-bold uppercase tracking-wider rounded border transition-all ${bookData.status === 'BORROWED' ? 'bg-slate-700 text-white border-slate-800 shadow-md transform scale-105 z-10' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        Prêté
                     </button>
                   </div>
                   
                   {/* Apparition du lien URL externe structuré */}
                   {bookData.status === 'ONLINE' && (
                     <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                       <Input value={bookData.online_url} onChange={e => setBookData({...bookData, online_url: e.target.value})} placeholder="URL Complète (ex: https://drive.google.com/...)" className="bg-blue-50/50 border-blue-200 text-blue-900 text-xs font-mono h-9 transition-colors focus:bg-white" />
                     </div>
                   )}
                </div>

                {/* ARBRE CATEGORIEL INTELLIGENT (SANS POPUP FENETRE) */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center">
                      Topologie & Tags DB
                    </label>
                  </div>
                  
                  <div className="flex space-x-2 items-center">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 px-3 tracking-widest uppercase text-[10px]">Emplacement</Badge>
                    <Input value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="Étagère A2" className="bg-white h-9 text-xs font-mono" />
                  </div>

                  <div className="space-y-2">
                    <div className="min-h-[60px] p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-1.5 shadow-inner">
                       {dbCategories.length === 0 ? <span className="text-[10px] text-slate-400 p-2 font-medium">Aucune catégorie raccordée.</span> : 
                          dbCategories.map(cat => {
                            const isSel = selectedCatIds.includes(cat.id)
                            const isSub = !!cat.parent_id
                            return (
                              <Badge 
                                 key={cat.id} 
                                 variant="outline"
                                 onClick={() => toggleCategorySelection(cat.id)}
                                 className={`cursor-pointer transition-all select-none ${isSel ? 'bg-slate-800 text-white border-transparent shadow' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'} ${isSub ? 'opacity-80 border-dashed ml-3 text-[10px]' : ''}`}
                              >
                                 {isSel && <span className="mr-1 opacity-70">●</span>} {cat.name}
                              </Badge>
                            )
                          })
                       }
                    </div>

                    <div className="pt-2 border-t border-slate-100/50">
                      <Button variant="ghost" size="sm" onClick={() => setShowCatManager(!showCatManager)} className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500 hover:text-slate-900">
                        {showCatManager ? "Fermer Paramètres Tags" : "↳ Éditer L'arbre des Catégories"}
                      </Button>
                      
                      {showCatManager && (
                        <div className="mt-2 p-3 bg-white border border-slate-200 shadow-sm rounded-lg space-y-3 animate-in fade-in slide-in-from-top-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nouveau Label Permanent</p>
                          <Input placeholder="Intitulé (ex: Hadith)" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-8 text-xs bg-slate-50 border-slate-200" />
                          <select value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)} className="w-full text-xs h-8 bg-slate-50 border border-slate-200 rounded-md text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300">
                            <option value="">-- [Aucune] Fixer comme Racine --</option>
                            {dbCategories.filter(c => !c.parent_id).map(c => (
                              <option key={c.id} value={c.id}>Sous-menu de : "{c.name}"</option>
                            ))}
                          </select>
                          <Button onClick={handleCreateCategory} disabled={!newCatName} size="sm" className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-900 font-bold">Inscrire en DB Centrale</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SYNOPSIS & NOTE STRICTE */}
                <div className="space-y-1.5 pt-4">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Résumé Intégral</label>
                  <textarea 
                    className="flex min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 resize-y"
                    value={bookData.synopsis} 
                    onChange={e => setBookData({...bookData, synopsis: e.target.value})} 
                    placeholder="Structure narrative..."
                  />
                </div>

                <div className="space-y-1.5 mt-4 p-3 bg-slate-50 border border-slate-200 shadow-inner rounded-xl group transition-all">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center mb-2">
                     <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span>
                     Traceur Mouchard Admin
                  </label>
                  <textarea 
                    className="flex min-h-[50px] w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-sm placeholder:text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 resize-y font-mono text-slate-600"
                    value={bookData.private_note} 
                    onChange={e => setBookData({...bookData, private_note: e.target.value})} 
                    placeholder="Destinataire de l'emprunt (Numéro, Nom, Date). Invisible côté Front."
                  />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3 border-t bg-slate-50/80 px-6 py-5 rounded-b-xl z-20 sticky bottom-0">
              {editingId ? (
                <>
                  <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-slate-800 hover:bg-slate-900 font-bold text-white shadow-md">
                    {loading ? "Synchronisation Supabase..." : "Enregistrer Altération"}
                  </Button>
                  <Button variant="ghost" onClick={resetForm} disabled={loading} className="w-full text-slate-500 hover:text-slate-800 h-8 text-xs font-bold uppercase tracking-widest">
                    Abandonner L'Édition
                  </Button>
                </>
              ) : (
                <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-slate-900 hover:bg-slate-800 font-bold text-white shadow-lg py-6 text-sm uppercase tracking-widest">
                  {loading ? "Injection Cloud..." : "Déploiement D-Base"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        
        {/* COLONNE DROITE : DATA CENTER */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-200">
            <h2 className="text-xl font-extrabold flex items-center space-x-3 text-slate-800">
              <span>Data Center Logistique</span> 
              <Badge variant="secondary" className="font-mono bg-slate-100 text-slate-700 text-sm px-3 shadow-inner">{allBooks.length}</Badge>
            </h2>
            <Button onClick={fetchInventory} variant="outline" size="sm" className="bg-white text-xs font-bold uppercase tracking-widest text-slate-500 border-slate-200">Force Reload</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {allBooks.length === 0 ? (
               <div className="col-span-full py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl flex flex-col items-center justify-center font-medium shadow-sm">
                 <span className="text-4xl mb-4 opacity-50 block w-full">📡</span>
                 Base de données isolée : Aucun flux entrant détecté.
               </div>
            ) : (
              allBooks.map(book => (
                <Card key={book.id} className="shadow-sm border-slate-200 hover:shadow-xl hover:border-slate-400 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
                  <div className="h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b border-black/5 relative p-4 shrink-0 shadow-inner">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-90 group-hover:scale-[1.03] transition-transform duration-700 rounded-sm shadow border border-black/5" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full w-full bg-white rounded-sm shadow-sm border border-slate-200">
                        <span className="text-3xl mb-1 opacity-20 block text-slate-600">📘</span>
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest select-none px-4 text-center line-clamp-2">{book.title}</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 shadow outline-none rounded transition-all">
                       {getStatusBadge(book.status)}
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2 p-4 bg-white z-10 relative">
                    <CardTitle className="text-sm font-extrabold line-clamp-2 leading-tight text-slate-900" title={book.title}>{book.title}</CardTitle>
                    <div className="flex justify-between items-center mt-1">
                      <CardDescription className="text-[11px] truncate font-bold text-slate-500 uppercase tracking-widest">{book.author || "Auteur Inconnu"}</CardDescription>
                      <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-50 px-1 rounded">{book.published_date}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-50">
                       {book.language && <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-slate-50 text-slate-500 border-slate-200 rounded-sm px-1.5">{book.language}</Badge>}
                       {book.locations && <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-widest bg-slate-100 text-slate-700 rounded-sm px-1.5">[{book.locations.shelf}]</Badge>}
                       {book.book_categories && book.book_categories.map(bc => (
                          <Badge variant="secondary" key={bc.category_id} className="text-[9px] font-bold uppercase tracking-widest bg-slate-800 text-white rounded-sm px-1.5"># {bc.categories?.name}</Badge>
                       ))}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-0 text-[11px] bg-white space-y-1 mt-auto">
                     {book.status === 'ONLINE' && book.online_url && (
                        <div className="p-2 mb-2 bg-slate-50 border border-slate-200 rounded text-slate-600 line-clamp-1 border-dashed">
                           <a href={book.online_url} target="_blank" rel="noreferrer" className="font-mono text-[9px] hover:text-blue-600 transition-colors uppercase tracking-widest font-bold">Ouvrir URL ↗</a>
                        </div>
                     )}
                     {book.private_note && (
                       <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 shadow-inner">
                         <p className="line-clamp-2 text-amber-900 text-[10px] leading-tight font-medium">
                           <span className="font-extrabold uppercase mr-1">Trak:</span> 
                           {book.private_note}
                         </p>
                       </div>
                     )}
                  </CardContent>

                  <CardFooter className="p-3 flex justify-between space-x-2 border-t border-slate-100 bg-slate-50/50 relative z-10 w-full mt-auto">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(book)} className="text-[10px] h-8 font-bold px-4 border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white flex-1 transition-colors uppercase tracking-widest">
                      [+] Extraire Node
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(book.id)} className="h-8 w-8 text-rose-500 hover:text-white hover:bg-rose-600 transition-colors shadow-sm bg-white border border-rose-100" title="Vaporiser DB Entry">
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
