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

  const [dbCategories, setDbCategories] = useState([])
  const [selectedCatIds, setSelectedCatIds] = useState([])
  
  // Custom Toast State (remplace Alert)
  const [toast, setToast] = useState(null)
  const showToastMsg = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Categories Manager Component State
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
    
    const exists = dbCategories.find(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())
    if (exists) {
      showToastMsg("Structure bloquée : Ce nom de domaine existe déjà.", "error")
      return;
    }

    const { error } = await supabase.from('categories').insert([{ name: newCatName.trim(), parent_id }])
    if (!error) {
       showToastMsg(`Label "${newCatName}" généré dans l'arbre.`, "success")
       setNewCatName('')
       setNewCatParentId('')
       fetchCategories()
    } else showToastMsg("Erreur Base de Données.", "error")
  }

  const handleDeleteCategory = async (id, name) => {
    // Custom inline confirm override
    if (window.confirm(`Voulez-vous raser la catégorie "${name}" du système ? Cela déconnectera tous les livres liés.`)) {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (!error) {
         showToastMsg(`Noeud ${name} vaporisé.`, "error")
         fetchCategories()
      }
    }
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
        showToastMsg("Terminal API : Empreinte vierge non reconnue.", "error")
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 5 * 1024 * 1024) {
        showToastMsg("Image trop volumineuse. Surcharge bloquée.", "error")
        return;
      }
      setCoverFile(file)
      setCoverPreview(URL.createObjectURL(file))
    }
  }

  const handleCoverUpload = async () => {
    if (!coverFile) return bookData.cover_url; 
    const fileExt = coverFile.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `public/${fileName}`

    const { error: uploadError } = await supabase.storage.from('covers').upload(filePath, coverFile)

    if (uploadError) {
      showToastMsg("Violation de Sécurité RLS pendant l'upload.", "error")
      return bookData.cover_url
    }

    const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
    showToastMsg("Fichier lourd encodé via Storage.", "success")
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

      showToastMsg(editingId ? "Propulsion Cloud : Override du bloc Validé ! 🔥" : "Propulsion Cloud : Livre injecté en Base ! 🔥")
      resetForm()
      fetchInventory()
    } catch (err) {
      showToastMsg("Base Erreur : Crash Structurel. Le schéma est manquant.", "error")
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
    if (window.confirm("Action Irréversible ! Es-tu sûr de vaporiser l'intégralité des datas de cet ouvrage sur les serveurs AWS Supabase ?")) {
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (!error) {
        showToastMsg("Formatage de l'Entité Réussi.", "error")
        fetchInventory()
      }
    }
  }

  const getStatusBadge = (status) => {
    if(status === 'AVAILABLE') return <Badge className="bg-emerald-600 shadow-sm border border-emerald-800 text-white font-bold tracking-widest uppercase text-[10px]">Sur Étagère</Badge>
    if(status === 'ONLINE') return <Badge className="bg-blue-600 shadow-sm border border-blue-800 text-white font-bold tracking-widest uppercase text-[10px]">Digital</Badge>
    if(status === 'BORROWED') return <Badge className="bg-slate-600 shadow-sm border border-slate-800 text-white font-bold tracking-widest uppercase text-[10px]">Prêté</Badge>
    return <Badge className="bg-emerald-500">AVAILABLE</Badge> 
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* FLOATING TOAST SYSTEM (Remplace l'alerte JS) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 lg:bottom-10 lg:right-10 px-5 py-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom border-2 flex items-center max-w-sm ${toast.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-rose-200' : 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-emerald-200'}`}>
          <span className="text-2xl mr-3">{toast.type === 'error' ? '🚫' : '✓'}</span>
          <span className="font-extrabold text-xs uppercase tracking-widest leading-tight">{toast.msg}</span>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Poste de Commandement <span className="text-indigo-600 ml-2">V3.5</span></h1>
          <p className="text-slate-500 mt-1 font-medium">Contrôlez les encodages, les règles d'architecture et les attributions physiques.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[450px_1fr] xl:grid-cols-[500px_1fr]">
        
        {/* COLONNE GAUCHE : FORMULAIRE */}
        <div className="space-y-6 lg:sticky lg:top-24 h-fit max-h-[85vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
          <Card className={`shadow-xl transition-all duration-300 border-2 ${editingId ? 'border-amber-400 bg-amber-50/20 shadow-amber-100' : 'border-slate-200'}`}>
            <CardHeader className={`${editingId ? 'bg-amber-100/50' : 'bg-slate-50'} rounded-t-xl pb-4 border-b border-black/5`}>
              <div className="flex justify-between items-center mb-1">
                <CardTitle className={editingId ? "text-amber-900 text-lg" : "text-slate-900 text-lg font-black"}>{editingId ? "Opération Override BDD" : "Création d'un Nouveau Node"}</CardTitle>
                {editingId && <Badge variant="outline" className="bg-amber-200 text-amber-800 border-amber-400 uppercase tracking-widest text-[9px] font-bold">Terminal Actif</Badge>}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6 pt-5 bg-white backdrop-blur-sm px-6">
              
              {!editingId && (
                 <div className="relative group">
                   <Input 
                     type="text" 
                     placeholder="Scanner Code QR Visuel 📷" 
                     className="pl-5 h-12 w-full rounded-xl bg-slate-50 border-slate-200 border-2 shadow-inner focus:ring-2 ring-indigo-200 focus:bg-white transition-all font-mono font-bold text-slate-700 placeholder:text-slate-400"
                     value={isbn}
                     onChange={(e) => setIsbn(e.target.value)}
                   />
                   <Button onClick={searchOpenLibrary} disabled={loading} className="absolute right-1 top-1 h-10 w-24 bg-slate-900 hover:bg-slate-800 text-[10px] uppercase font-black tracking-widest rounded-lg">API PULL</Button>
                 </div>
              )}

              <div className="space-y-5 pt-1">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entité Titre</label>
                    <Input value={bookData.title} onChange={e => setBookData({...bookData, title: e.target.value})} placeholder="Requis" className="bg-white font-bold text-slate-800 border-slate-300" />
                  </div>
                  <Input value={bookData.author} onChange={e => setBookData({...bookData, author: e.target.value})} placeholder="Auteur (Requis)" className="bg-slate-50 border-slate-300 font-medium" />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Réf</label>
                     <Input value={bookData.published_date} onChange={e => setBookData({...bookData, published_date: e.target.value})} placeholder="ex: 1405" className="bg-white text-xs h-9 border-slate-300" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Langue</label>
                     <select 
                       className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
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

                {/* MODÈLE UPLOAD SANS POPUP DÉGUEULASSE */}
                <div className="space-y-2 p-3 border border-dashed border-slate-300 rounded-xl bg-white">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Routage Stockage (Cover Image)</label>
                  <div className="flex items-center space-x-4">
                    <div className="h-14 w-10 bg-slate-100 border border-slate-200 rounded overflow-hidden flex-shrink-0 shadow-inner">
                       {coverPreview ? <img src={coverPreview} className="object-cover w-full h-full" alt="Preview" /> : <div className="w-full h-full flex flex-col items-center justify-center text-[8px] text-slate-300 font-bold uppercase tracking-widest text-center px-1 leading-tight"><span className="text-xl opacity-20">☁️</span></div>}
                    </div>
                    <div className="flex-1">
                      <Input id="cover-upload" type="file" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} className="hidden" />
                      <label htmlFor="cover-upload" className="flex items-center justify-center w-full h-9 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-800 cursor-pointer transition-all focus-within:ring-2">
                        Injecter Fichier.JPG
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl border-2 border-slate-200 bg-white shadow-sm">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                     <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2"></span> Module Distribution
                   </label>
                   <div className="grid grid-cols-3 gap-2 mt-2">
                     <button onClick={() => setBookData({...bookData, status: 'AVAILABLE'})} className={`py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${bookData.status === 'AVAILABLE' ? 'bg-emerald-600 text-emerald-50 border-emerald-700 shadow-md ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        Étagère
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'ONLINE'})} className={`py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${bookData.status === 'ONLINE' ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        Digital
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'BORROWED'})} className={`py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${bookData.status === 'BORROWED' ? 'bg-slate-800 text-slate-100 border-slate-900 shadow-md ring-2 ring-slate-300' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        Prêté
                     </button>
                   </div>
                   
                   {bookData.status === 'ONLINE' && (
                     <div className="mt-3 bg-blue-50/50 p-2 border border-blue-100 rounded-lg">
                       <Input value={bookData.online_url} onChange={e => setBookData({...bookData, online_url: e.target.value})} placeholder="URL Complète (ex: Drive/PDF)" className="bg-white border-blue-200 text-blue-900 text-xs font-mono h-9 shadow-sm" />
                     </div>
                   )}
                </div>

                {/* MODULE CATEGORIE HAUTE DEFINITION */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex space-x-2 items-center mb-4 border border-slate-200 rounded-lg p-1 bg-slate-50">
                    <Badge variant="secondary" className="bg-white text-slate-500 px-3 tracking-widest border border-slate-200 uppercase text-[9px] shadow-sm">RAYON_PHYSIQUE</Badge>
                    <Input value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="ex: C2" className="bg-transparent border-0 ring-0 focus-visible:ring-0 shadow-none text-xs font-black text-slate-800" />
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Câblage des Thématiques</label>
                    <div className="min-h-[70px] p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 shadow-inner">
                       {dbCategories.length === 0 ? <span className="text-[10px] text-slate-400 p-2 font-medium">Bases vides.</span> : 
                          dbCategories.filter(c=>!c.parent_id).map(parentCat => {
                            const isParentSel = selectedCatIds.includes(parentCat.id)
                            const children = dbCategories.filter(c => c.parent_id === parentCat.id)
                            return (
                               <div key={parentCat.id} className="flex flex-wrap items-center gap-1.5 p-1">
                                 <Badge 
                                   variant="outline"
                                   onClick={() => toggleCategorySelection(parentCat.id)}
                                   className={`cursor-pointer transition-all select-none border-2 text-[10px] ${isParentSel ? 'bg-slate-800 text-white border-slate-900 shadow' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                                 >
                                    {isParentSel && <span className="mr-1">★</span>} {parentCat.name}
                                 </Badge>
                                 {children.map(child => {
                                    const isChildSel = selectedCatIds.includes(child.id)
                                    return (
                                      <Badge 
                                         key={child.id} variant="outline" onClick={() => toggleCategorySelection(child.id)}
                                         className={`cursor-pointer select-none text-[9px] px-2 h-5 flex items-center ${isChildSel ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-100 text-slate-500 border-slate-200 border-dashed hover:bg-slate-200'}`}
                                      >
                                         <span className="opacity-50 mr-1 text-[8px]">↳</span> {child.name}
                                      </Badge>
                                    )
                                 })}
                               </div>
                            )
                          })
                       }
                    </div>

                    <div className="pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowCatManager(!showCatManager)} className={`text-[10px] font-black tracking-widest uppercase transition-all w-full border ${showCatManager ? 'bg-slate-800 text-white hover:bg-slate-900 border-slate-900' : 'text-slate-500 hover:text-slate-800 bg-white border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                        {showCatManager ? "[-_Fermer_l'outil_DB_]" : "[+] Outil de restructuration complet"}
                      </Button>
                      
                      {/* LE GESTIONNAIRE DE CATÉGORIE PRO INTERNE */}
                      {showCatManager && (
                        <div className="mt-3 p-4 bg-slate-50 border-2 border-slate-200 shadow-sm rounded-xl space-y-5 animate-in fade-in slide-in-from-top-1">
                          
                          {/* CREATE FORM */}
                          <div className="space-y-2 pb-4 border-b border-slate-200">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Insérer un Noeud</p>
                            <Input placeholder="Intitulé (ex: Philosophie)" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-9 text-xs font-bold bg-white border-slate-300 shadow-sm" />
                            <select value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)} className="w-full text-xs h-9 bg-white border border-slate-300 shadow-sm rounded-md font-semibold text-slate-700 cursor-pointer">
                              <option value="">-- Mode : Noeud Primaire Indépendant --</option>
                              {dbCategories.filter(c => !c.parent_id).map(c => (
                                <option key={c.id} value={c.id}>Insérer le Tag COMME SOUS-MENU DE : "{c.name}"</option>
                              ))}
                            </select>
                            <Button onClick={handleCreateCategory} disabled={!newCatName} size="sm" className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest mt-1">Exécuter Génération</Button>
                          </div>

                          {/* LIST & DELETE */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Vaporiser les Noeuds Existants</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                               {dbCategories.filter(c=>!c.parent_id).map(parent => (
                                 <div key={parent.id} className="bg-white border text-xs border-slate-200 rounded p-2 shadow-sm space-y-1">
                                    <div className="flex justify-between items-center font-bold text-slate-800">
                                       <span>{parent.name}</span>
                                       <Button onClick={()=>handleDeleteCategory(parent.id, parent.name)} variant="ghost" className="h-6 w-6 p-0 text-rose-400 hover:bg-rose-50 hover:text-rose-600"><span className="text-[10px]">✕</span></Button>
                                    </div>
                                    <div className="pl-3 space-y-1 mt-1 border-l-2 border-slate-100">
                                       {dbCategories.filter(c=>c.parent_id === parent.id).map(child => (
                                         <div key={child.id} className="flex justify-between items-center text-slate-500 font-medium">
                                            <span><span className="opacity-50">↳</span> {child.name}</span>
                                            <Button onClick={()=>handleDeleteCategory(child.id, child.name)} variant="ghost" className="h-5 w-5 p-0 text-rose-300 hover:bg-rose-50 hover:text-rose-600"><span className="text-[8px]">✕</span></Button>
                                         </div>
                                       ))}
                                    </div>
                                 </div>
                               ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requisitio Intégrale</label>
                  <textarea 
                    className="flex min-h-[90px] w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-xs shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:bg-white resize-y font-medium text-slate-700"
                    value={bookData.synopsis} 
                    onChange={e => setBookData({...bookData, synopsis: e.target.value})} 
                    placeholder="Synthèse officielle..."
                  />
                </div>

                {/* NOTE ADMIN */}
                <div className="space-y-1.5 mt-4 p-3 bg-amber-50/50 border border-amber-200 shadow-inner rounded-xl group transition-all">
                  <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center mb-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 flex-shrink-0 animate-pulse"></span>
                     Mouchard Interne (Sécurisé)
                  </label>
                  <textarea 
                    className="flex min-h-[50px] w-full rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 resize-y font-mono text-slate-700 font-semibold"
                    value={bookData.private_note} 
                    onChange={e => setBookData({...bookData, private_note: e.target.value})} 
                    placeholder="Historique des prêts ou anomalies du manuel. Chiffré."
                  />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3 border-t bg-slate-50/80 px-6 py-5 rounded-b-xl z-20 sticky bottom-0">
              {editingId ? (
                <>
                  <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-amber-500 hover:bg-amber-600 font-black tracking-widest uppercase text-[11px] text-white shadow-xl shadow-amber-200 py-6">
                    {loading ? "Re-Compilation DB..." : "ACTIVER OVERRIDE DU FICHIER"}
                  </Button>
                  <Button variant="ghost" onClick={resetForm} disabled={loading} className="w-full text-slate-500 hover:text-slate-800 hover:bg-slate-200 h-8 text-[10px] font-bold uppercase tracking-widest">
                    Abandonner L'Édition
                  </Button>
                </>
              ) : (
                <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-slate-900 hover:bg-indigo-600 transition-colors font-black text-white shadow-xl py-6 text-xs uppercase tracking-widest">
                  {loading ? "Injection Cloud..." : "⚡ ENVOYER DANS L'ARCHITECTURE"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        
        {/* COLONNE DROITE : DATA CENTER */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-200">
            <h2 className="text-xl font-extrabold flex items-center space-x-3 text-slate-800">
              <span>Réseau Opérationnel</span> 
              <Badge variant="secondary" className="font-mono bg-slate-100 text-slate-700 text-sm px-3 shadow-inner">{allBooks.length}</Badge>
            </h2>
            <Button onClick={fetchInventory} variant="outline" size="sm" className="bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 border-slate-200 hover:text-indigo-600 transition-colors shadow-sm">Sync DB</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {allBooks.length === 0 ? (
               <div className="col-span-full py-24 text-center text-slate-400 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                 <span className="text-4xl mb-4 opacity-30 block w-full">🛰️</span>
                 <p className="font-bold text-sm tracking-widest uppercase text-slate-500">Silence Radio</p>
                 <p className="text-xs font-mono mt-1 opacity-70">Aucune donnée captée sur le réseau distant.</p>
               </div>
            ) : (
              allBooks.map(book => (
                <Card key={book.id} className="shadow-sm border border-slate-200 hover:shadow-xl hover:border-slate-400 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
                  <div className="h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-200 relative p-4 shrink-0 shadow-inner">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700 rounded-sm shadow-md" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full w-full bg-white rounded-sm shadow-sm border border-slate-200">
                        <span className="text-3xl mb-1 opacity-20 block text-slate-500">📎</span>
                        <span className="text-slate-400 font-bold text-[9px] uppercase tracking-widest select-none px-4 text-center line-clamp-2">{book.title}</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 transition-all">
                       {getStatusBadge(book.status)}
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2 p-4 bg-white z-10 relative">
                    <CardTitle className="text-sm font-extrabold line-clamp-2 leading-tight text-slate-900 group-hover:text-indigo-600 transition-colors" title={book.title}>{book.title}</CardTitle>
                    <div className="flex justify-between items-center mt-1">
                      <CardDescription className="text-[10px] truncate font-black text-slate-400 uppercase tracking-wider">{book.author || "Auteur Inconnu"}</CardDescription>
                      <span className="text-[9px] text-slate-500 font-black bg-slate-100 px-1.5 py-0.5 rounded shadow-inner uppercase tracking-widest">{book.published_date || "D-0"}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-50">
                       {book.language && <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-white text-slate-500 border-slate-200 shadow-sm">{book.language}</Badge>}
                       {book.locations && <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 border border-slate-200 shadow-inner">[{book.locations.shelf}]</Badge>}
                       {book.book_categories && book.book_categories.map(bc => (
                          <Badge variant="secondary" key={bc.category_id} className="text-[8px] font-black uppercase tracking-widest bg-slate-800 text-slate-100 border border-slate-900 shadow-sm">#{bc.categories?.name}</Badge>
                       ))}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-0 text-[11px] bg-white space-y-1 mt-auto">
                     {book.status === 'ONLINE' && book.online_url && (
                        <div className="p-2 mb-2 bg-blue-50/50 border border-blue-200 rounded text-slate-600 line-clamp-1 border-dashed transition-colors hover:bg-blue-100">
                           <a href={book.online_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-800 font-mono text-[9px] uppercase tracking-widest font-black">
                             <span className="mr-2">🌐</span> OUVIR URL ↗
                           </a>
                        </div>
                     )}
                     {book.private_note && (
                       <div className="bg-amber-50/80 border border-amber-200 rounded p-2 mb-3 shadow-inner mt-2">
                         <p className="line-clamp-2 text-amber-900 text-[9px] leading-tight font-bold font-mono">
                           <span className="font-black uppercase mr-1 text-amber-600">[LOG]:</span> 
                           {book.private_note}
                         </p>
                       </div>
                     )}
                  </CardContent>

                  <CardFooter className="p-3 flex justify-between space-x-2 border-t border-slate-100 bg-slate-50/80 relative z-10 w-full mt-auto">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(book)} className="text-[9px] h-8 font-black px-4 border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white flex-1 transition-colors uppercase tracking-widest bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5">
                      ⟲ EDIT_NODE
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(book.id)} className="h-8 w-8 text-rose-400 hover:text-white hover:bg-rose-500 transition-all shadow-sm bg-white border border-rose-100" title="Vaporiser DB Entry">
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
