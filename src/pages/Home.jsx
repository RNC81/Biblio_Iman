import { useState, useEffect } from 'react'
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/hooks/useDebounce'
import { getCoverUrl } from '@/lib/cloudinary'

export default function Home() {
  const [books, setBooks] = useState([])
  const [filteredBooks, setFilteredBooks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBookModal, setSelectedBookModal] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // States des filtres de la barre latérale 
  const [selectedLanguage, setSelectedLanguage] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)
  
  const [openCollections, setOpenCollections] = useState({})
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const stripArabicDiacritics = (str) => {
    if (!str) return '';
    return str.replace(/[\u064B-\u065F\u0670]/g, '');
  }

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBooks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('books')
      .select('*, locations(shelf), book_categories(categories(id, name, parent_id)), collections(id, name), book_copies(id, copy_number, status)')
      .order('created_at', { ascending: false })
      
    if (!error && data) {
      setBooks(data)
      setFilteredBooks(data)
    }
    setLoading(false)
  }

  // Moteur de Recherche Global et Filtrage
  useEffect(() => {
    let result = books;

    // 1. Recherche Textuelle Globale (Titre, Auteur, Synopsis, ISBN)
    if (debouncedSearchTerm) {
      const q = stripArabicDiacritics(debouncedSearchTerm.toLowerCase());
      const motsCles = q.split(/[\s-]+/).filter(i => i)
      
      result = result.filter(b => {
         const t1 = stripArabicDiacritics(b.title ? b.title.toLowerCase() : '')
         const t2 = stripArabicDiacritics(b.transliterated_title ? b.transliterated_title.toLowerCase() : '')
         const a1 = stripArabicDiacritics(b.author ? b.author.toLowerCase() : '')
         const a2 = stripArabicDiacritics(b.transliterated_author ? b.transliterated_author.toLowerCase() : '')
         const i = b.isbn ? b.isbn : ''
         const s = stripArabicDiacritics(b.synopsis ? b.synopsis.toLowerCase() : '') // Recherche étendue au résumé
         const texteComplet = `${t1} ${t2} ${a1} ${a2} ${i} ${s}`
         
         return motsCles.every(mot => texteComplet.includes(mot))
      })
    }

    // 2. Filtres Précis de la partie gauche
    if (selectedLanguage) {
      result = result.filter(b => b.language === selectedLanguage)
    }
    if (selectedStatus) {
      result = result.filter(b => b.status === selectedStatus)
    }
    if (selectedAuthor) {
      result = result.filter(b => b.author === selectedAuthor)
    }
    if (selectedCat) {
      result = result.filter(b => {
         if (!b.book_categories) return false;
         return b.book_categories.some(bc => bc.categories?.name === selectedCat)
      })
    }
    if (selectedCollection) {
      result = result.filter(b => b.collections?.name === selectedCollection)
    }

    setFilteredBooks(result)
  }, [debouncedSearchTerm, books, selectedLanguage, selectedStatus, selectedCat, selectedAuthor, selectedCollection])

  // Génération automatique des choix de la barre latérale 
  // Langues par défaut garanties pour la vue, plus celles trouvées 
  const languesDeBase = ["Français", "Arabe", "Persan", "Anglais", "Multi-langues"]
  const extractedLangues = [...new Set(books.map(b => b.language).filter(Boolean))]
  const availableLanguages = [...new Set([...languesDeBase, ...extractedLangues])].sort()

  // Auteurs disponibles avec leur translittération associée (dédoublonnés par nom)
  const availableAuthors = Object.values(
    books.reduce((acc, b) => {
      if (b.author && !acc[b.author]) {
        acc[b.author] = { author: b.author, transliterated_author: b.transliterated_author || null }
      }
      return acc;
    }, {})
  ).sort((a, b) => a.author.localeCompare(b.author))
  
  const allCatNames = []
  books.forEach(b => {
    if (b.book_categories) {
      b.book_categories.forEach(bc => {
        if(bc.categories?.name) allCatNames.push(bc.categories.name)
      })
    }
  })
  const availableCategories = [...new Set(allCatNames)].sort()

  // Collections disponibles
  const availableCollections = [...new Set(books.map(b => b.collections?.name).filter(Boolean))].sort()

  // Grouper les livres filtrés par collection pour l'affichage
  const getGroupedBooks = () => {
    const collections = {}
    const standalone = []

    filteredBooks.forEach(book => {
      if (book.collections) {
        const colName = book.collections.name
        if (!collections[colName]) {
          collections[colName] = { id: book.collections.id, name: colName, books: [] }
        }
        collections[colName].books.push(book)
      } else {
        standalone.push(book)
      }
    })

    // Trier les volumes dans chaque collection
    Object.values(collections).forEach(col => {
      col.books.sort((a, b) => (a.volume_number || 999) - (b.volume_number || 999))
    })

    return { collections: Object.values(collections), standalone }
  }

  const toggleCollection = (colName) => {
    setOpenCollections(prev => ({ ...prev, [colName]: !prev[colName] }))
  }

  // Calculer le résumé des exemplaires pour un livre
  const getCopiesSummary = (book) => {
    if (!book.book_copies || book.book_copies.length === 0) return null;
    const total = book.book_copies.length;
    const available = book.book_copies.filter(c => c.status === 'AVAILABLE').length;
    return { total, available }
  }

  // Effectuer une redirection fluide vers un autre livre
  const handleRedirectToBook = (targetTitle) => {
    setSelectedBookModal(null)
    setSelectedCollection(null)
    setSelectedLanguage(null)
    setSelectedStatus(null)
    setSelectedAuthor(null)
    setSelectedCat(null)
    setSearchTerm(targetTitle)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Petite aide visuelle qui affiche la hiérarchie Catégorie Parent > Enfant
  // On l'adapte ici si besoin, bien que le Home ne charge pas toute la table catégories, 
  // on utilise simplement les noms directs extraits.

  const StatusOverlay = ({ status }) => {
    if (status === 'AVAILABLE') return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] px-3 py-1 shadow pointer-events-none">DISPONIBLE ICI</Badge>
    if (status === 'BORROWED') return <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-extrabold border border-slate-200 text-[10px] px-3 py-1 shadow pointer-events-none">ACTUELLEMENT PRÊTÉ</Badge>
    if (status === 'ONLINE') return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] px-3 py-1 shadow pointer-events-none">RESSOURCE EN LIGNE (WEB)</Badge>
    return null
  }

  const CopiesBadge = ({ book }) => {
    const summary = getCopiesSummary(book)
    if (!summary) return null
    return (
      <div className="flex items-center gap-1 mt-1">
        <Badge variant="outline" className={`text-[9px] font-bold border ${summary.available > 0 ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-300 bg-slate-50 text-slate-500'}`}>
          {summary.available}/{summary.total} exemplaire{summary.total > 1 ? 's' : ''} disponible{summary.available > 1 ? 's' : ''}
        </Badge>
      </div>
    )
  }

  const BookCard = ({ book }) => (
    <Card 
      onClick={() => setSelectedBookModal(book)}
      className="group cursor-pointer overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-3xl flex flex-col hover:-translate-y-1"
    >
       
       {/* IMAGE COUVERTURE */}
       <div className="h-60 bg-slate-50 flex items-center justify-center overflow-hidden relative border-b border-black/5">
           {book.cover_url ? (
              <img src={getCoverUrl(book.cover_url, 400)} alt={book.title} loading="lazy" className="object-cover w-full h-full opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500" />
            ) : (
              <div className="flex flex-col items-center opacity-30 group-hover:opacity-50 transition-opacity">
                <span className="text-6xl mb-2 grayscale">📓</span>
              </div>
            )}

           <div className="absolute top-4 left-4 z-10 transition-transform group-hover:scale-105 flex flex-col gap-1">
              <StatusOverlay status={book.status} />
              {book.volume_number && (
                <Badge className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-[10px] px-3 py-1 shadow pointer-events-none">
                  Volume {book.volume_number}
                </Badge>
              )}
           </div>
       </div>

       <CardContent className="p-6 flex-1 flex flex-col justify-between">
           <div>
              <div className="flex flex-wrap gap-2 mb-3">
                 {book.status === 'ONLINE' && <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold tracking-widest border border-blue-200 px-2 py-0.5">FORMAT NUMÉRIQUE</Badge>}
                 {book.language && <Badge variant="outline" className="font-bold text-slate-500 border-slate-200 px-2 py-0.5">{book.language}</Badge>}
              </div>
              <h2 className="text-xl font-bold text-slate-900 line-clamp-2 leading-tight mb-1 group-hover:text-indigo-600 transition-colors" title={book.title}>{book.title}</h2>
              {book.transliterated_title && <p className="text-xs font-bold text-slate-500 italic mb-1.5 line-clamp-1">{book.transliterated_title}</p>}
              <p className="text-sm font-semibold text-indigo-600 mb-1.5">
                {book.author || "Auteur inconnu"}
                {book.transliterated_author && <span className="text-xs font-normal text-slate-500 italic ml-2">({book.transliterated_author})</span>}
              </p>
              
              {(book.publisher || book.established_by) && (
                <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wider">
                  {book.publisher && <span className="bg-slate-100 px-2 py-1 rounded-md">🏢 {book.publisher}</span>}
                  {book.established_by && <span className="bg-slate-100 px-2 py-1 rounded-md">✍️ Établi par {book.established_by}</span>}
                </div>
              )}
              {!book.publisher && !book.established_by && <div className="mb-2"></div>}
              
              <CopiesBadge book={book} />
              
              <p className="text-slate-600 text-sm line-clamp-3 leading-relaxed mb-4 mt-3">{book.synopsis || "Ce livre ne possède pas encore de résumé enregistré dans notre catalogue."}</p>
              
              {/* LIENS DE TRADUCTION */}
              {(() => {
                const originalBook = book.original_book_id ? books.find(b => b.id === book.original_book_id) : null;
                const availableTranslations = books.filter(b => b.original_book_id === book.id);
                
                if (!originalBook && availableTranslations.length === 0 && !book.translator && !book.original_title) return null;
                
                return (
                  <div className="space-y-2 mt-4 pt-3 border-t border-slate-100/60">
                    {book.translator && (
                       <p className="text-[11px] font-bold text-pink-600/80 mb-1">Traduit par : <span className="text-pink-600">{book.translator}</span></p>
                    )}
                    {originalBook ? (
                       <Button 
                         variant="outline" 
                         onClick={(e) => { e.stopPropagation(); handleRedirectToBook(originalBook.title); }}
                         className="w-full justify-start h-8 px-3 text-[10px] font-bold border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 hover:text-pink-800 uppercase tracking-wide"
                       >
                         🔗 Voir l'original ({originalBook.language || 'Autre'})
                       </Button>
                    ) : book.original_title ? (
                       <p className="text-[11px] font-bold text-slate-500 mb-1">Titre original : <span className="text-slate-700 italic">{book.original_title}</span></p>
                    ) : null}
                    {availableTranslations.length > 0 && availableTranslations.map(tr => (
                       <Button 
                         key={tr.id}
                         variant="outline" 
                         onClick={(e) => { e.stopPropagation(); handleRedirectToBook(tr.title); }}
                         className="w-full justify-start h-8 px-3 text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 uppercase tracking-wide"
                       >
                         🔗 Voir traduction en {tr.language || 'Autre'}
                       </Button>
                    ))}
                  </div>
                );
              })()}
           </div>
           
           <div className="space-y-4 mt-auto pt-4">
               <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
                  {book.book_categories && book.book_categories.map(bc => (
                     <Badge key={bc.categories?.id} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold px-3 py-1 border border-slate-200 cursor-default">{bc.categories?.name}</Badge>
                  ))}
               </div>
               
               <div className="flex items-center justify-between mt-5 pt-2">
                  {book.locations ? (
                     <div className="flex items-center bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200 shadow-inner">
                       <span className="text-sm mr-2 text-slate-400">📍</span>
                       <span className="text-xs font-bold text-slate-600 uppercase">{book.locations.shelf}</span>
                     </div>
                  ) : <div></div>}

                  {book.status === 'ONLINE' && book.online_url && (
                     <a href={book.online_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                       <Button className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all">Consulter ↗</Button>
                     </a>
                  )}
               </div>
           </div>
       </CardContent>
    </Card>
  )

  // Carte "Dossier" de Collection
  const CollectionFolder = ({ collection }) => {
    const isOpen = openCollections[collection.name]
    const totalBooks = collection.books.length
    const totalCopiesAvailable = collection.books.reduce((acc, book) => {
      const summary = getCopiesSummary(book)
      return acc + (summary ? summary.available : 0)
    }, 0)
    const totalCopies = collection.books.reduce((acc, book) => {
      const summary = getCopiesSummary(book)
      return acc + (summary ? summary.total : 0)
    }, 0)

    // Prendre la cover du premier livre comme aperçu
    const previewCover = collection.books.find(b => b.cover_url)?.cover_url

    return (
      <div className="col-span-full">
        {/* En-tête du dossier */}
        <div 
          onClick={() => toggleCollection(collection.name)}
          className={`cursor-pointer group border-2 rounded-2xl transition-all duration-300 overflow-hidden ${isOpen ? 'border-violet-300 bg-violet-50/50 shadow-lg' : 'border-slate-200 bg-white hover:border-violet-200 hover:shadow-md shadow-sm'}`}
        >
          <div className="flex items-center gap-5 p-5">
            {/* Icône dossier / aperçu */}
            <div className={`w-16 h-20 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 transition-all border ${isOpen ? 'border-violet-300 bg-violet-100' : 'border-slate-200 bg-slate-50'}`}>
              {previewCover ? (
                <img src={getCoverUrl(previewCover, 200)} alt="" loading="lazy" className="object-cover w-full h-full rounded-xl opacity-80" />
              ) : (
                <span className="text-3xl">📁</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-extrabold text-slate-900 truncate group-hover:text-violet-700 transition-colors">{collection.name}</h3>
                <Badge className="bg-violet-600 text-white font-bold text-[10px] shadow-sm flex-shrink-0">
                  {totalBooks} volume{totalBooks > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 font-medium">
                Collection complète · {totalCopies > 0 ? `${totalCopiesAvailable}/${totalCopies} exemplaires disponibles` : 'Ressources numériques'}
              </p>
            </div>

            <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Contenu du dossier (les volumes) */}
        {isOpen && (
          <div className="mt-4 pl-4 border-l-4 border-violet-200 animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
              {collection.books.map(book => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const { collections: groupedCollections, standalone: standaloneBooks } = loading ? { collections: [], standalone: [] } : getGroupedBooks()

  return (
    <div className="min-h-screen bg-[#fcfcfc] border-t border-slate-200">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col md:flex-row gap-8 lg:gap-12">
        
        {/* =========================================
            MENU DES FILTRES À GAUCHE
            ========================================= */}
        <div className="w-full md:w-64 lg:w-72 shrink-0 space-y-6">
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
              <h3 className="font-extrabold text-slate-800 text-xl mb-6 tracking-tight">Affiner la recherche</h3>
              
              {/* Disponibilité */}
              <div className="space-y-3 mb-8">
                <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Disponibilité</p>
                <div onClick={()=>setSelectedStatus(null)} className={`text-sm cursor-pointer transition-all flex items-center group ${!selectedStatus ? 'font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                   <div className={`w-3 h-3 rounded-sm border mr-3 flex items-center justify-center ${!selectedStatus ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {!selectedStatus && <span className="text-white text-[8px] font-bold">✓</span>}
                   </div>
                   Tous les supports
                </div>
                <div onClick={()=>setSelectedStatus('AVAILABLE')} className={`text-sm cursor-pointer transition-all flex items-center group ${selectedStatus === 'AVAILABLE' ? 'font-bold text-emerald-700' : 'text-slate-600 hover:text-slate-900'}`}>
                   <div className={`w-3 h-3 rounded-sm border mr-3 flex items-center justify-center ${selectedStatus === 'AVAILABLE' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                      {selectedStatus === 'AVAILABLE' && <span className="text-white text-[8px] font-bold">✓</span>}
                   </div>
                   Ouvrages Physiques Dispos
                </div>
                <div onClick={()=>setSelectedStatus('ONLINE')} className={`text-sm cursor-pointer transition-all flex items-center group ${selectedStatus === 'ONLINE' ? 'font-bold text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}>
                   <div className={`w-3 h-3 rounded-sm border mr-3 flex items-center justify-center ${selectedStatus === 'ONLINE' ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                      {selectedStatus === 'ONLINE' && <span className="text-white text-[8px] font-bold">✓</span>}
                   </div>
                   Ouvrages Numériques
                </div>
              </div>

              {/* Collections */}
              {availableCollections.length > 0 && (
                <div className="space-y-3 mb-8">
                  <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Collections / Séries</p>
                  <div onClick={()=>setSelectedCollection(null)} className={`text-sm cursor-pointer transition-all flex items-center group ${!selectedCollection ? 'font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                     <span className={`w-1.5 h-1.5 rounded-full mr-3 ${!selectedCollection ? 'bg-indigo-600' : 'bg-slate-200 group-hover:bg-slate-400'}`}></span>
                     Toutes
                  </div>
                  {availableCollections.map(col => (
                     <div key={col} onClick={()=>setSelectedCollection(col)} className={`text-sm flex items-center cursor-pointer transition-all group ${selectedCollection === col ? 'font-bold text-violet-700' : 'text-slate-600 hover:text-slate-900'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-3 ${selectedCollection === col ? 'bg-violet-600' : 'bg-slate-200 group-hover:bg-slate-400'}`}></span>
                        📁 {col}
                     </div>
                  ))}
                </div>
              )}

              {/* Langues */}
              <div className="space-y-3 mb-8">
                <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Langue de lecture</p>
                <div onClick={()=>setSelectedLanguage(null)} className={`text-sm cursor-pointer transition-all flex items-center group ${!selectedLanguage ? 'font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                   <div className={`w-3 h-3 rounded-full border mr-3 flex items-center justify-center ${!selectedLanguage ? 'border-4 border-indigo-600' : 'border-slate-300'}`}></div>
                   Toutes les langues
                </div>
                {availableLanguages.map(lang => (
                   <div key={lang} onClick={()=>setSelectedLanguage(lang)} className={`text-sm cursor-pointer transition-all flex items-center group ${selectedLanguage === lang ? 'font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                      <div className={`w-3 h-3 rounded-full border mr-3 transition-all ${selectedLanguage === lang ? 'border-4 border-indigo-600' : 'border-slate-300'}`}></div>
                      {lang}
                   </div>
                ))}
              </div>

              {/* Auteurs Specifiques */}
              {availableAuthors.length > 0 && (
                <div className="space-y-3 mb-8">
                  <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Auteurs fréquents</p>
                  <select 
                     className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                     value={selectedAuthor || ""} 
                     onChange={(e) => setSelectedAuthor(e.target.value || null)}
                  >
                     <option value="">Tous les auteurs</option>
                     {availableAuthors.map(({ author, transliterated_author }) => (
                         <option key={author} value={author}>
                           {author}{transliterated_author ? ` — ${transliterated_author}` : ''}
                         </option>
                     ))}
                  </select>
                </div>
              )}

              {/* Sujets & Catégories */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Sujets du livre</p>
                <div onClick={()=>setSelectedCat(null)} className={`text-sm cursor-pointer transition-all flex items-center group ${!selectedCat ? 'font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                   Universel <span className="opacity-0 ml-auto bg-slate-100 text-[8px] font-bold px-2 py-0.5 rounded-full group-hover:opacity-100 transition-opacity">X</span>
                </div>
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-3 pt-2">
                   {availableCategories.map(cat => (
                      <div key={cat} onClick={()=>setSelectedCat(cat)} className={`text-sm flex items-center cursor-pointer transition-all group ${selectedCat === cat ? 'font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                         <span className={`w-1.5 h-1.5 rounded-full mr-3 ${selectedCat === cat ? 'bg-indigo-600' : 'bg-slate-200 group-hover:bg-slate-400'}`}></span>
                         {cat}
                      </div>
                   ))}
                </div>
              </div>
           </div>
        </div>

        {/* =========================================
            GRILLE DU CATALOGUE 
            ========================================= */}
        <div className="flex-1 space-y-8">
            
            {/* BARRE DE RECHERCHE PRINCIPALE */}
            <div className="relative group max-w-3xl">
              <span className="absolute inset-y-0 left-6 flex items-center text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <Input 
                type="text" 
                placeholder="Rechercher par titre, auteur, ou mots du résumé..." 
                className="pl-16 h-[64px] w-full rounded-2xl bg-white border border-slate-200 text-base shadow-sm focus:ring-4 ring-indigo-50 transition-all font-medium text-slate-800 placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                 <Button variant="ghost" onClick={() => setSearchTerm('')} className="absolute right-4 top-3 h-10 w-10 p-0 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-50 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                 </Button>
              )}
            </div>

            {loading ? (
              <div className="py-32 text-center text-slate-400 flex flex-col items-center">
                 <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                 <p className="font-bold tracking-wide uppercase text-sm text-indigo-800/60">Chargement de votre catalogue en cours...</p>
              </div>
            ) : filteredBooks.length === 0 ? (
               <div className="py-20 mt-6 text-center border border-slate-200 bg-white rounded-3xl flex flex-col items-center shadow-sm">
                  <span className="text-5xl opacity-40 mb-4">📚</span>
                  <p className="text-slate-700 font-bold text-lg mb-1">Aucun livre ne correspond à votre recherche.</p>
                  <p className="text-slate-500 font-medium">Vous pouvez réessayer avec d'autres mots-clés ou désactiver certains filtres.</p>
                  <Button onClick={() => {setSearchTerm(''); setSelectedCat(null); setSelectedLanguage(null); setSelectedStatus(null); setSelectedAuthor(null); setSelectedCollection(null)}} variant="outline" className="mt-6 border-indigo-200 text-indigo-700 bg-indigo-50 font-bold hover:bg-indigo-600 hover:text-white rounded-xl transition-all">Afficher tous les livres</Button>
               </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 ml-2 select-none">
                  {filteredBooks.length} LIVRE{filteredBooks.length > 1 ? 'S' : ''} DANS LE CATALOGUE
                </p>
                
                <div className="space-y-8">
                  {/* Collections groupées (dossiers) */}
                  {groupedCollections.length > 0 && (
                    <div className="space-y-4">
                      {groupedCollections.map(col => (
                        <CollectionFolder key={col.id} collection={col} />
                      ))}
                    </div>
                  )}

                  {/* Livres individuels (hors collection) */}
                  {standaloneBooks.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                      {standaloneBooks.map(book => (
                        <BookCard key={book.id} book={book} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>

      <Dialog open={!!selectedBookModal} onOpenChange={(open) => !open && setSelectedBookModal(null)}>
        <DialogContent className="sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[1000px] w-full p-0 overflow-hidden bg-white gap-0 border-none rounded-3xl shadow-2xl">
          {selectedBookModal && (
            <div className="flex flex-col md:flex-row h-[85vh] max-h-[800px] w-full">
               {/* SIDEBAR IMAGE */}
               <div className="md:w-1/3 bg-slate-100 flex flex-col pt-10 p-6 items-center shrink-0 border-r border-slate-200 overflow-y-auto">
                 {selectedBookModal.cover_url ? (
                     <img src={getCoverUrl(selectedBookModal.cover_url, 600)} alt={selectedBookModal.title} loading="lazy" className="w-56 rounded-xl shadow-2xl" />
                  ) : (
                     <div className="w-56 h-72 bg-slate-200 rounded-xl shadow-inner flex items-center justify-center">
                       <span className="text-6xl grayscale">📓</span>
                     </div>
                  )}
                  <div className="mt-8 w-full space-y-4">
                     <div className="flex justify-center w-full">
                       <StatusOverlay status={selectedBookModal.status} />
                     </div>
                     {selectedBookModal.status === 'ONLINE' && selectedBookModal.online_url && (
                        <a href={selectedBookModal.online_url} target="_blank" rel="noreferrer" className="block w-full">
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-md uppercase tracking-wider text-xs">Consulter en Ligne ↗</Button>
                        </a>
                     )}
                     {selectedBookModal.locations && (
                        <div className="flex items-center justify-center bg-white rounded-xl p-4 border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-full">
                          <span className="text-2xl mr-3">📍</span>
                          <div className="text-left w-full">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Localisation / Étagère</p>
                             <p className="text-base font-black text-slate-800 uppercase">{selectedBookModal.locations.shelf}</p>
                          </div>
                        </div>
                     )}
                  </div>
               </div>
               
               {/* MAIN CONTENT */}
               <div className="md:w-2/3 p-8 md:p-10 flex flex-col justify-between overflow-y-auto bg-white">
                  <div>
                     <DialogHeader className="text-left space-y-3 mb-6">
                       <div className="flex flex-wrap gap-2 mb-1">
                          {selectedBookModal.language && <Badge variant="outline" className="font-bold text-slate-500 border-slate-300 bg-white">{selectedBookModal.language}</Badge>}
                          {selectedBookModal.published_date && <Badge variant="secondary" className="font-bold bg-slate-100 text-slate-700">Publié en {selectedBookModal.published_date}</Badge>}
                          {selectedBookModal.isbn && <Badge variant="secondary" className="font-mono font-bold bg-slate-50 text-slate-500 border border-slate-200">ISBN {selectedBookModal.isbn}</Badge>}
                       </div>
                       
                       {selectedBookModal.collections && (
                         <p className="text-xs font-black text-violet-600 uppercase tracking-widest flex items-center bg-violet-50 w-fit px-3 py-1 rounded-full">
                           📁 {selectedBookModal.collections.name} {selectedBookModal.volume_number && <span className="ml-1 opacity-70"> / Volume {selectedBookModal.volume_number}</span>}
                         </p>
                       )}
                       
                       <DialogTitle className="text-3xl md:text-4xl font-black text-slate-900 leading-tight tracking-tight mt-2">{selectedBookModal.title}</DialogTitle>
                       {selectedBookModal.transliterated_title && (
                         <p className="text-lg md:text-xl font-bold text-slate-500 italic leading-snug">{selectedBookModal.transliterated_title}</p>
                       )}
                       <p className="text-xl font-bold text-indigo-600">
                          {selectedBookModal.author || "Auteur inconnu"}
                          {selectedBookModal.transliterated_author && <span className="text-base font-normal text-slate-500 italic ml-2">({selectedBookModal.transliterated_author})</span>}
                       </p>
                     </DialogHeader>
                     
                     {/* INFOS ADDITIONNELLES */}
                     {(selectedBookModal.publisher || selectedBookModal.established_by || selectedBookModal.translator) && (
                       <div className="grid grid-cols-2 gap-4 mb-8 p-5 bg-slate-50/80 rounded-2xl border border-slate-100">
                          {selectedBookModal.publisher && <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Maison d'Édition</p><p className="text-sm font-bold text-slate-800">🏢 {selectedBookModal.publisher}</p></div>}
                          {selectedBookModal.established_by && <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Établi par</p><p className="text-sm font-bold text-slate-800">✍️ {selectedBookModal.established_by}</p></div>}
                          {selectedBookModal.translator && <div className="col-span-2 mt-2 pt-2 border-t border-slate-200/60"><p className="text-[10px] font-black text-pink-500 uppercase tracking-wider mb-1">Traducteur (Traduction)</p><p className="text-sm font-bold text-pink-700">🌍 {selectedBookModal.translator}</p></div>}
                       </div>
                     )}
                     
                     {/* LIENS / TRADUCTIONS */}
                     {(() => {
                        const origBook = selectedBookModal.original_book_id ? books.find(b => b.id === selectedBookModal.original_book_id) : null;
                        const availTranslations = books.filter(b => b.original_book_id === selectedBookModal.id);
                        if (origBook || availTranslations.length > 0 || selectedBookModal.original_title) {
                          return (
                             <div className="space-y-3 mb-8">
                                {origBook ? (
                                   <Button variant="outline" onClick={() => handleRedirectToBook(origBook.title)} className="w-full justify-start h-12 border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 font-black uppercase tracking-wide rounded-xl">
                                     🔗 Voir l'oeuvre originale ({origBook.language || 'Autre'})
                                   </Button>
                                ) : selectedBookModal.original_title ? (
                                   <div className="w-full flex items-center h-12 px-4 border border-slate-200 text-slate-600 bg-slate-50 font-black uppercase tracking-wide rounded-xl text-sm">
                                     Titre Original : <span className="ml-2 text-slate-800">{selectedBookModal.original_title}</span>
                                   </div>
                                ) : null}
                                {availTranslations.map(tr => (
                                   <Button key={tr.id} variant="outline" onClick={() => handleRedirectToBook(tr.title)} className="w-full justify-start h-12 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-black uppercase tracking-wide rounded-xl">
                                     🔗 Voir traduction en {tr.language || 'Autre'}
                                   </Button>
                                ))}
                             </div>
                          )
                        }
                        return null;
                     })()}

                     <div className="mb-8">
                       <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <span className="w-4 h-1 bg-indigo-600 rounded-full"></span> À Propos (Synopsis)
                       </p>
                       <div className="text-slate-700 font-medium text-[15px] leading-relaxed whitespace-pre-wrap bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                         {selectedBookModal.synopsis || "Ce livre ne possède pas encore de résumé complet enregistré."}
                       </div>
                     </div>
                  </div>
                  
                  <div className="mt-8 pt-8 border-t border-slate-200">
                     {(() => {
                       const summary = getCopiesSummary(selectedBookModal);
                       if (summary) {
                         return (
                           <div className={`flex items-center justify-between p-4 rounded-2xl border mb-5 shadow-sm ${summary.available > 0 ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'}`}>
                             <div className="flex items-center gap-4">
                               <span className="text-3xl">{summary.available > 0 ? '📦' : '❌'}</span>
                               <div>
                                 <p className={`text-[11px] font-black uppercase tracking-widest ${summary.available > 0 ? 'text-teal-700' : 'text-slate-500'}`}>Équipement Manuel • {summary.total} Exemplaires</p>
                                 <p className={`text-base font-black ${summary.available > 0 ? 'text-teal-900' : 'text-slate-700'}`}>{summary.available} Disponibles à l'emprunt</p>
                               </div>
                             </div>
                           </div>
                         )
                       }
                     })()}
                     
                     <div className="flex flex-wrap gap-2">
                        {selectedBookModal.book_categories && selectedBookModal.book_categories.map(bc => (
                           <Badge key={bc.categories?.id} variant="secondary" className="bg-slate-100 text-slate-700 cursor-default text-xs font-bold px-4 py-1.5 border border-slate-200 rounded-lg">{bc.categories?.name}</Badge>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
