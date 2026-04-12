import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'

// Fenêtre (Modal) de confirmation véritable et esthétique
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
       <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-500 text-sm mb-6">{message}</p>
          <div className="flex justify-end gap-3">
             <Button variant="outline" onClick={onCancel} className="font-bold border-slate-200">Annuler</Button>
             <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 font-bold text-white shadow-md">Confirmer la suppression</Button>
          </div>
       </div>
    </div>
  )
}

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
  
  const [toast, setToast] = useState(null)
  const showToastMsg = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Modals States pour Suppression 
  const [bookToDelete, setBookToDelete] = useState(null)
  const [catToDelete, setCatToDelete] = useState(null)

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
      showToastMsg("Cette catégorie existe déjà.", "error")
      return;
    }

    const { error } = await supabase.from('categories').insert([{ name: newCatName.trim(), parent_id }])
    if (!error) {
       showToastMsg(`Catégorie "${newCatName}" ajoutée avec succès.`, "success")
       setNewCatName('')
       setNewCatParentId('')
       fetchCategories()
    } else showToastMsg("Erreur lors de la création.", "error")
  }

  const confirmDeleteCategory = async () => {
    if(!catToDelete) return
    const { error } = await supabase.from('categories').delete().eq('id', catToDelete.id)
    if (!error) {
       showToastMsg(`Catégorie supprimée.`, "success")
       fetchCategories()
    }
    setCatToDelete(null)
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
        showToastMsg("Aucun livre trouvé avec ce code.", "error")
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
        showToastMsg("L'image est trop volumineuse (Maximum 5 Mo).", "error")
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
      showToastMsg("Erreur lors de l'envoi de l'image.", "error")
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

      showToastMsg(editingId ? "Le livre a bien été modifié !" : "Le livre a bien été ajouté au catalogue !")
      resetForm()
      fetchInventory()
    } catch (err) {
      showToastMsg("Erreur lors de la sauvegarde.", "error")
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

  const confirmDeleteBook = async () => {
    if(!bookToDelete) return;
    const { error } = await supabase.from('books').delete().eq('id', bookToDelete.id)
    if (!error) {
      showToastMsg("Le livre a été retiré du catalogue.", "success")
      fetchInventory()
    }
    setBookToDelete(null)
  }

  // Permet d'afficher Parent > Enfant visuellement pour l'humain
  const getCategoryPath = (catId) => {
    const cat = dbCategories.find(c => c.id === catId);
    if (!cat) return "";
    if (cat.parent_id) {
        const parent = dbCategories.find(c => c.id === cat.parent_id);
        return parent ? `${parent.name} > ${cat.name}` : cat.name;
    }
    return cat.name;
  }

  const getStatusBadge = (status) => {
    if(status === 'AVAILABLE') return <Badge className="bg-emerald-600 shadow-sm text-white font-bold tracking-widest uppercase text-[10px]">Sur Étagère</Badge>
    if(status === 'ONLINE') return <Badge className="bg-blue-600 shadow-sm text-white font-bold tracking-widest uppercase text-[10px]">Digital</Badge>
    if(status === 'BORROWED') return <Badge className="bg-slate-600 shadow-sm text-white font-bold tracking-widest uppercase text-[10px]">Prêté</Badge>
    return <Badge className="bg-emerald-500">AVAILABLE</Badge> 
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* Composants de Pop-up (Modals) Intégrés Propres */}
      <ConfirmModal 
         isOpen={!!catToDelete}
         title="Supprimer la catégorie"
         message={`Êtes-vous sûr de vouloir supprimer définitivement la catégorie "${catToDelete?.name}" ? Cela retirera ce label de tous les livres concernés.`}
         onCancel={() => setCatToDelete(null)}
         onConfirm={confirmDeleteCategory}
      />

      <ConfirmModal 
         isOpen={!!bookToDelete}
         title="Retirer ce livre de l'inventaire"
         message={`Êtes-vous sûr de vouloir supprimer l'ouvrage "${bookToDelete?.title}" de votre catalogue ? Cette action est irréversible.`}
         onCancel={() => setBookToDelete(null)}
         onConfirm={confirmDeleteBook}
      />

      {/* Notification discrète pour les succès */}
      {toast && (
        <div className={`fixed bottom-6 right-6 lg:bottom-10 lg:right-10 px-5 py-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom border flex items-center max-w-sm ${toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <span className="text-2xl mr-3">{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span className="font-bold text-sm leading-tight">{toast.msg}</span>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestion de la Bibliothèque</h1>
          <p className="text-slate-500 mt-1 font-medium">Ajoutez, modifiez ou supprimez les ouvrages de votre catalogue de manière centralisée.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[450px_1fr] xl:grid-cols-[500px_1fr]">
        
        {/* COLONNE GAUCHE : FORMULAIRE ADMIN */}
        <div className="space-y-6 lg:sticky lg:top-24 h-fit max-h-[85vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
          <Card className={`shadow-xl transition-all duration-300 border-2 border-slate-200`}>
            <CardHeader className={`${editingId ? 'bg-indigo-50/50' : 'bg-slate-50'} rounded-t-xl pb-4 border-b border-black/5`}>
              <div className="flex justify-between items-center mb-1">
                <CardTitle className="text-slate-900 text-lg font-black">{editingId ? "Modifier le livre" : "Ajouter un Livre"}</CardTitle>
                {editingId && <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200 uppercase tracking-widest text-[9px] font-bold">En Édition</Badge>}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6 pt-5 bg-white backdrop-blur-sm px-6">
              
              {!editingId && (
                 <div className="relative group">
                   <Input 
                     type="text" 
                     placeholder="Scanner un Code-barres ou QR..." 
                     className="pl-5 h-12 w-full rounded-xl bg-slate-50 border-slate-200 shadow-inner focus:ring-2 ring-indigo-200 focus:bg-white transition-all font-medium text-slate-700"
                     value={isbn}
                     onChange={(e) => setIsbn(e.target.value)}
                   />
                   <Button onClick={searchOpenLibrary} disabled={loading} className="absolute right-1 top-1 h-10 px-4 bg-slate-900 hover:bg-slate-800 text-[10px] uppercase font-black tracking-widest rounded-lg">Rechercher</Button>
                 </div>
              )}

              <div className="space-y-5 pt-1">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre de l'ouvrage</label>
                    <Input value={bookData.title} onChange={e => setBookData({...bookData, title: e.target.value})} placeholder="(Obligatoire)" className="bg-white font-bold text-slate-900 border-slate-300" />
                  </div>
                  <Input value={bookData.author} onChange={e => setBookData({...bookData, author: e.target.value})} placeholder="Auteur complet" className="bg-slate-50 border-slate-300 font-medium" />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de publication</label>
                     <Input value={bookData.published_date} onChange={e => setBookData({...bookData, published_date: e.target.value})} placeholder="ex: 2024" className="bg-white text-xs h-9 border-slate-300" />
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
                       <option value="Persan">Persan</option>
                       <option value="Multi-langues">Multi-langues</option>
                     </select>
                  </div>
                </div>

                {/* UPLOAD SIMPLIFIÉ */}
                <div className="space-y-2 p-3 border border-slate-200 bg-slate-50 rounded-xl">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Image de la couverture</label>
                  <div className="flex items-center space-x-4">
                    <div className="h-14 w-10 bg-white border border-slate-300 rounded flex-shrink-0">
                       {coverPreview ? <img src={coverPreview} className="object-cover w-full h-full rounded" alt="Apeçu" /> : <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center"></div>}
                    </div>
                    <div className="flex-1">
                      <Input id="cover-upload" type="file" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} className="hidden" />
                      <label htmlFor="cover-upload" className="flex items-center justify-center w-full h-9 rounded-md border border-slate-300 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition-all shadow-sm">
                        Choisir une image sur l'ordinateur...
                      </label>
                    </div>
                  </div>
                </div>

                {/* LES STATUTS SANS JARGON */}
                <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                     Disponibilité et Support
                   </label>
                   <div className="grid grid-cols-3 gap-2 mt-2">
                     <button onClick={() => setBookData({...bookData, status: 'AVAILABLE'})} className={`py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${bookData.status === 'AVAILABLE' ? 'bg-emerald-600 text-emerald-50 border-emerald-700 shadow-md ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        Sur place
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'ONLINE'})} className={`py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${bookData.status === 'ONLINE' ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        En Ligne (Web)
                     </button>
                     <button onClick={() => setBookData({...bookData, status: 'BORROWED'})} className={`py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${bookData.status === 'BORROWED' ? 'bg-slate-700 text-slate-100 border-slate-800 shadow-md ring-2 ring-slate-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        Actuellement Prêté
                     </button>
                   </div>
                   
                   {bookData.status === 'ONLINE' && (
                     <div className="mt-3 bg-slate-50 p-2 border border-slate-200 rounded-lg">
                       <Input value={bookData.online_url} onChange={e => setBookData({...bookData, online_url: e.target.value})} placeholder="Collez le lien URL du livre (Drive, PDF...)" className="bg-white text-xs h-9 shadow-sm" />
                     </div>
                   )}
                </div>

                {/* CATEGORIES RENDUES "HUMAN-FRIENDLY" */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex space-x-2 items-center mb-4 border border-slate-200 bg-slate-50 rounded-lg p-1.5 shadow-inner">
                    <span className="text-[10px] font-bold text-slate-500 px-2 uppercase tracking-widest whitespace-nowrap">Emplacement Salle</span>
                    <Input value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="Ex: Étagère C2" className="bg-white border-slate-200 shadow-sm text-xs h-8 font-bold text-slate-800" />
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Les Filtres et Catégories de ce livre</label>
                    <div className="min-h-[70px] p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 shadow-inner">
                       {dbCategories.length === 0 ? <span className="text-[11px] text-slate-400 p-2 font-medium">Vous n'avez pas encore défini de catégories.</span> : 
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
                                    {isParentSel && <span className="mr-1">✓</span>} {parentCat.name}
                                 </Badge>
                                 {children.map(child => {
                                    const isChildSel = selectedCatIds.includes(child.id)
                                    return (
                                      <Badge 
                                         key={child.id} variant="outline" onClick={() => toggleCategorySelection(child.id)}
                                         className={`cursor-pointer select-none text-[10px] font-medium px-2 py-1 ${isChildSel ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 border-dashed hover:bg-slate-100'}`}
                                      >
                                         <span className="opacity-50 mr-1 text-[8px]">Enfant:</span> {child.name}
                                      </Badge>
                                    )
                                 })}
                               </div>
                            )
                          })
                       }
                    </div>

                    <div className="pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowCatManager(!showCatManager)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 transition-all uppercase tracking-widest w-full">
                        {showCatManager ? "Fermer le gestionnaire de catégories" : "Gérer les catégories existantes"}
                      </Button>
                      
                      {/* LE GESTIONNAIRE SOUPLE ET CLAIR */}
                      {showCatManager && (
                        <div className="mt-3 p-4 bg-white border border-slate-200 shadow-md rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">
                          
                          <div className="space-y-3 pb-4 border-b border-slate-100">
                            <p className="text-xs font-bold text-slate-800">Ajouter une nouvelle catégorie au catalogue</p>
                            <Input placeholder="Nom (Exemple: Période Abbasside)" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-9 text-xs" />
                            <select value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)} className="w-full text-xs h-9 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 p-2 cursor-pointer outline-none">
                              <option value="">-- C'est une Catégorie Principale --</option>
                              {dbCategories.filter(c => !c.parent_id).map(c => (
                                <option key={c.id} value={c.id}>S'affiche DANS la catégorie "{c.name}"</option>
                              ))}
                            </select>
                            <Button onClick={handleCreateCategory} disabled={!newCatName} size="sm" className="w-full h-9 bg-slate-900 text-white font-bold">Enregistrer et ajouter</Button>
                          </div>

                          <div className="space-y-3 mt-4">
                            <p className="text-xs font-bold text-slate-800">Vos catégories existantes :</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                               {dbCategories.filter(c=>!c.parent_id).map(parent => (
                                 <div key={parent.id} className="bg-slate-50 border border-slate-200 rounded p-2 space-y-1">
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                       <span>{parent.name}</span>
                                       <Button onClick={()=>setCatToDelete(parent)} variant="ghost" className="h-6 px-2 text-rose-500 hover:bg-rose-100 hover:text-rose-700 text-xs">Supprimer</Button>
                                    </div>
                                    <div className="pl-3 space-y-1 mt-1 border-l-2 border-slate-200">
                                       {dbCategories.filter(c=>c.parent_id === parent.id).map(child => (
                                         <div key={child.id} className="flex justify-between items-center text-sm text-slate-600">
                                            <span><span className="opacity-40 mr-1 text-xs">↳</span>{child.name}</span>
                                            <Button onClick={()=>setCatToDelete(child)} variant="ghost" className="h-6 px-2 text-rose-500 hover:bg-rose-100 text-xs">Supprimer</Button>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Le résumé du livre</label>
                  <textarea 
                    className="flex min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 resize-y"
                    value={bookData.synopsis} 
                    onChange={e => setBookData({...bookData, synopsis: e.target.value})} 
                    placeholder="Tapez le synopsis ici..."
                  />
                </div>

                <div className="space-y-1.5 mt-4 p-3 bg-amber-50/50 border border-amber-200 shadow-inner rounded-xl group transition-all">
                  <label className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center mb-2">
                     <span className="text-base mr-2">🔒</span>
                     Notes Internes (Espace privé de l'administrateur)
                  </label>
                  <textarea 
                    className="flex min-h-[50px] w-full rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 resize-y"
                    value={bookData.private_note} 
                    onChange={e => setBookData({...bookData, private_note: e.target.value})} 
                    placeholder="Ex: Emprunté par M. Dupont le 12 Mars (Invisible pour les visiteurs)"
                  />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3 border-t bg-slate-50 px-6 py-5 rounded-b-xl z-20 sticky bottom-0">
              {editingId ? (
                <>
                  <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-lg py-5">
                    {loading ? "Mise à jour..." : "SAUVEGARDER LES MODIFICATIONS"}
                  </Button>
                  <Button variant="ghost" onClick={resetForm} disabled={loading} className="w-full text-slate-500 hover:text-slate-800 hover:bg-slate-200 h-8 text-xs font-semibold">
                    Annuler
                  </Button>
                </>
              ) : (
                <Button onClick={saveToDatabase} disabled={!bookData.title || loading} className="w-full bg-slate-900 hover:bg-slate-800 transition-colors font-bold text-white shadow-lg py-6">
                  {loading ? "Ajout en cours..." : "AJOUTER LE LIVRE AU CATALOGUE"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        
        {/* COLONNE DROITE : VOTRE CATALOGUE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <h2 className="text-xl font-bold flex items-center text-slate-800">
              <span className="mr-3">Votre Catalogue</span> 
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-sm shadow-inner">{allBooks.length}</Badge>
            </h2>
            <Button onClick={fetchInventory} variant="ghost" size="sm" className="bg-white text-xs font-semibold text-slate-500 border border-slate-200 hover:text-slate-800 shadow-sm">Actualiser</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {allBooks.length === 0 ? (
               <div className="col-span-full py-24 text-center text-slate-400 border border-dashed border-slate-200 bg-slate-50 rounded-2xl flex flex-col items-center justify-center">
                 <span className="text-4xl mb-4 opacity-50 block w-full">📚</span>
                 <p className="font-bold text-lg text-slate-600">Aucun livre pour le moment</p>
                 <p className="text-sm mt-1">Commencez par ajouter votre premier livre dans le panneau gauche.</p>
               </div>
            ) : (
              allBooks.map(book => (
                <Card key={book.id} className="shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col overflow-hidden bg-white">
                  <div className="h-40 w-full bg-slate-50 flex items-center justify-center relative border-b border-slate-100">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-95" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300">
                        <span className="text-3xl mb-1">📘</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                       {getStatusBadge(book.status)}
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2 p-4">
                    <CardTitle className="text-base font-bold line-clamp-2 leading-tight text-slate-900" title={book.title}>{book.title}</CardTitle>
                    <div className="flex justify-between items-center mt-1">
                      <CardDescription className="text-xs truncate font-medium text-slate-500">{book.author || "Auteur inconnu"}</CardDescription>
                      <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">{book.published_date || "-"}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-50">
                       {book.language && <Badge variant="outline" className="text-[9px] font-bold bg-white text-slate-500">{book.language}</Badge>}
                       {book.locations && <Badge variant="secondary" className="text-[9px] font-bold bg-slate-100 text-slate-700">[{book.locations.shelf}]</Badge>}
                       {book.book_categories && book.book_categories.map(bc => (
                          <Badge variant="secondary" key={bc.category_id} className="text-[9px] font-medium bg-slate-800 text-slate-100" title={getCategoryPath(bc.category_id)}>
                             {bc.categories?.name}
                          </Badge>
                       ))}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-0 flex-1 space-y-2 mb-3">
                     {book.status === 'ONLINE' && book.online_url && (
                        <div className="p-2 bg-blue-50 border border-blue-100 rounded text-center">
                           <a href={book.online_url} target="_blank" rel="noreferrer" className="text-blue-700 text-xs font-bold underline">🔗 Ouvrir la version Numérique</a>
                        </div>
                     )}
                     {book.private_note && (
                       <div className="bg-amber-50 border border-amber-200 rounded p-2">
                         <p className="line-clamp-2 text-amber-900 text-xs font-medium">
                           <span className="font-bold mr-1 text-amber-700">Note:</span> 
                           {book.private_note}
                         </p>
                       </div>
                     )}
                  </CardContent>

                  <CardFooter className="p-3 flex justify-between space-x-2 border-t border-slate-100 bg-slate-50/50 mt-auto">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(book)} className="text-xs font-bold flex-1 bg-white hover:bg-slate-100 text-slate-700 border-slate-300">
                      📝 Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setBookToDelete(book)} className="bg-white border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                      Supprimer
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
