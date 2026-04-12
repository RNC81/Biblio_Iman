import { useState, useEffect } from 'react'
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/hooks/useDebounce'

export default function Home() {
  const [books, setBooks] = useState([])
  const [filteredBooks, setFilteredBooks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  
  // States des filtres Type Amazon Faceted
  const [selectedLanguage, setSelectedLanguage] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [selectedCat, setSelectedCat] = useState(null)
  
  // Hook Anti-Spam API
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBooks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('books')
      .select('*, locations(shelf), book_categories(categories(id, name, parent_id))')
      .order('created_at', { ascending: false })
      
    if (!error && data) {
      setBooks(data)
      setFilteredBooks(data)
    }
    setLoading(false)
  }

  // --- Moteur Hybride de Filtrage Asynchrone (Texte + Facets) ---
  useEffect(() => {
    let result = books;

    // 1. Matrice Textuelle (Fuzzy logic)
    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm.toLowerCase();
      // On remplace les espaces par des jokers SQL-like
      const wildcardParts = q.split(/[\s-]+/).filter(i => i)
      
      result = result.filter(b => {
         const t = b.title ? b.title.toLowerCase() : ''
         const a = b.author ? b.author.toLowerCase() : ''
         const i = b.isbn ? b.isbn : ''
         const concatString = `${t} ${a} ${i}`
         
         // Tous les mots-clés tapés doivent se retrouver quelque part
         return wildcardParts.every(part => concatString.includes(part))
      })
    }

    // 2. Filtres Exclusifs (Facets)
    if (selectedLanguage) {
      result = result.filter(b => b.language === selectedLanguage)
    }
    if (selectedStatus) {
      result = result.filter(b => b.status === selectedStatus)
    }
    if (selectedCat) {
      result = result.filter(b => {
         if (!b.book_categories) return false;
         return b.book_categories.some(bc => bc.categories?.name === selectedCat)
      })
    }

    setFilteredBooks(result)
  }, [debouncedSearchTerm, books, selectedLanguage, selectedStatus, selectedCat])

  // --- Extraction Intelligente des Menus Latéraux ---
  const availableLanguages = [...new Set(books.map(b => b.language).filter(Boolean))]
  const allCatNames = []
  books.forEach(b => {
    if (b.book_categories) {
      b.book_categories.forEach(bc => {
        if(bc.categories?.name) allCatNames.push(bc.categories.name)
      })
    }
  })
  const availableCategories = [...new Set(allCatNames)].sort()

  // --- UI Components ---
  const StatusOverlay = ({ status }) => {
    if (status === 'AVAILABLE') return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-emerald-50 border-emerald-600/50 font-extrabold uppercase tracking-widest text-[9px] px-3 py-1 shadow-lg pointer-events-none">Sur Étagère</Badge>
    if (status === 'BORROWED') return <Badge className="bg-white/90 hover:bg-white text-slate-500 border-slate-200 font-extrabold uppercase tracking-widest text-[9px] px-3 py-1 shadow-lg backdrop-blur pointer-events-none">En Lecture (Sorti)</Badge>
    if (status === 'ONLINE') return <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700/50 font-extrabold uppercase tracking-widest text-[9px] px-3 py-1 shadow-lg pointer-events-none">Ressource en Ligne</Badge>
    return null
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] border-t border-slate-200">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col md:flex-row gap-8 lg:gap-12">
        
        {/* =========================================
            SIDEBAR FILTRES MULTICRITÈRES (AMAZON-LIKE) 
            ========================================= */}
        <div className="w-full md:w-64 lg:w-72 shrink-0 space-y-6">
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 sticky top-24">
              <h3 className="font-extrabold text-slate-900 text-lg mb-6 tracking-tight flex items-center">
                 <svg width="20" height="20" className="mr-2 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                 Filtres Logistiques
              </h3>
              
              {/* Statut Bloc */}
              <div className="space-y-3 mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Disponibilité</p>
                <div onClick={()=>setSelectedStatus(null)} className={`text-sm cursor-pointer transition-all flex items-center group ${!selectedStatus ? 'font-black text-indigo-700' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                   <div className={`w-3 h-3 rounded-sm border mr-3 flex items-center justify-center ${!selectedStatus ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-slate-400'}`}>
                      {!selectedStatus && <span className="text-white text-[8px] font-bold">✓</span>}
                   </div>
                   Tous les supports
                </div>
                <div onClick={()=>setSelectedStatus('AVAILABLE')} className={`text-sm cursor-pointer transition-all flex items-center group ${selectedStatus === 'AVAILABLE' ? 'font-black text-emerald-700' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                   <div className={`w-3 h-3 rounded-sm border mr-3 flex items-center justify-center ${selectedStatus === 'AVAILABLE' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 group-hover:border-slate-400'}`}>
                      {selectedStatus === 'AVAILABLE' && <span className="text-white text-[8px] font-bold">✓</span>}
                   </div>
                   Physique (Sur Étagère)
                </div>
                <div onClick={()=>setSelectedStatus('ONLINE')} className={`text-sm cursor-pointer transition-all flex items-center group ${selectedStatus === 'ONLINE' ? 'font-black text-blue-700' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                   <div className={`w-3 h-3 rounded-sm border mr-3 flex items-center justify-center ${selectedStatus === 'ONLINE' ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-slate-400'}`}>
                      {selectedStatus === 'ONLINE' && <span className="text-white text-[8px] font-bold">✓</span>}
                   </div>
                   Versions Digitales
                </div>
                <div onClick={()=>setSelectedStatus('BORROWED')} className={`text-sm cursor-pointer transition-all flex items-center group ${selectedStatus === 'BORROWED' ? 'font-black text-slate-900' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                   <div className={`w-3 h-3 rounded-sm border mr-3 flex items-center justify-center ${selectedStatus === 'BORROWED' ? 'bg-slate-700 border-slate-700' : 'border-slate-300 group-hover:border-slate-400'}`}>
                      {selectedStatus === 'BORROWED' && <span className="text-white text-[8px] font-bold">✓</span>}
                   </div>
                   Actuellement Prêtés
                </div>
              </div>

              {/* Langue Bloc */}
              <div className="space-y-3 mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Langue de l'Ouvrage</p>
                <div onClick={()=>setSelectedLanguage(null)} className={`text-sm cursor-pointer transition-all flex items-center group ${!selectedLanguage ? 'font-black text-indigo-700' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                   <div className={`w-3 h-3 rounded-full border mr-3 flex items-center justify-center ${!selectedLanguage ? 'border-4 border-indigo-600' : 'border-slate-300 group-hover:border-slate-400'}`}></div>
                   Polyglotte
                </div>
                {availableLanguages.map(lang => (
                   <div key={lang} onClick={()=>setSelectedLanguage(lang)} className={`text-sm cursor-pointer transition-all flex items-center group ${selectedLanguage === lang ? 'font-black text-indigo-700' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                      <div className={`w-3 h-3 rounded-full border mr-3 transition-all ${selectedLanguage === lang ? 'border-4 border-indigo-600' : 'border-slate-300 group-hover:border-slate-400'}`}></div>
                      {lang}
                   </div>
                ))}
              </div>

              {/* Categories Bloc */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Réseau des Thèmes</p>
                <div onClick={()=>setSelectedCat(null)} className={`text-sm cursor-pointer transition-all flex items-center group ${!selectedCat ? 'font-black text-indigo-700' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                   Universel <span className="opacity-0 ml-auto bg-slate-100 text-[8px] font-bold px-2 py-0.5 rounded-full group-hover:opacity-100 transition-opacity">X</span>
                </div>
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-3 pt-2">
                   {availableCategories.map(cat => (
                      <div key={cat} onClick={()=>setSelectedCat(cat)} className={`text-sm flex items-center cursor-pointer transition-all group ${selectedCat === cat ? 'font-black text-indigo-700' : 'text-slate-500 font-medium hover:text-slate-800'}`}>
                         <span className={`w-1.5 h-1.5 rounded-full mr-3 ${selectedCat === cat ? 'bg-indigo-600' : 'bg-slate-200 group-hover:bg-slate-400'}`}></span>
                         {cat}
                      </div>
                   ))}
                </div>
              </div>
           </div>
        </div>

        {/* =========================================
            RESULTS AREA (MOTEUR AFFICHAGE MATRICE)
            ========================================= */}
        <div className="flex-1 space-y-8">
            
            {/* MEGA SEARCH INPUT */}
            <div className="relative group max-w-3xl">
              <span className="absolute inset-y-0 left-6 flex items-center text-indigo-300 group-focus-within:text-indigo-600 transition-colors">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <Input 
                type="text" 
                placeholder="Chercher un Titre, Auteur ou Tag (Fuzzy Search)..." 
                className="pl-16 h-[72px] w-full rounded-full bg-white border-slate-200 text-lg shadow-sm focus:ring-4 ring-indigo-600/10 transition-all font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                 <Button variant="ghost" onClick={() => setSearchTerm('')} className="absolute right-4 top-4 h-10 w-10 p-0 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                 </Button>
              )}
            </div>

            {loading ? (
              <div className="py-32 text-center text-slate-400 flex flex-col items-center">
                 <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                 <p className="font-extrabold tracking-widest uppercase text-sm text-indigo-800/50">Extraction depuis le Data Center...</p>
              </div>
            ) : filteredBooks.length === 0 ? (
               <div className="py-24 mt-8 text-center border-2 border-dashed border-slate-200/60 bg-white/50 backdrop-blur-sm rounded-3xl flex flex-col items-center shadow-sm">
                  <span className="text-6xl opacity-30 mb-5">📭</span>
                  <p className="text-slate-600 font-extrabold text-xl mb-1">Aucune correspondance trouvée dans cet environnement.</p>
                  <p className="text-slate-400 font-medium">Réinitialisez la matrice de filtres ou modifiez votre requête texte.</p>
                  <Button onClick={() => {setSearchTerm(''); setSelectedCat(null); setSelectedLanguage(null); setSelectedStatus(null)}} variant="outline" className="mt-6 border-indigo-200 text-indigo-700 bg-indigo-50 font-bold hover:bg-indigo-600 hover:text-white rounded-xl transition-all">Nettoyer les filtres</Button>
               </div>
            ) : (
              <div>
                <p className="text-xs font-black text-slate-400 tracking-widest uppercase mb-6 ml-2 select-none">
                  {filteredBooks.length} ENTRÉE{filteredBooks.length > 1 ? 'S' : ''} SUR LE RÉSEAU
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                  {filteredBooks.map(book => (
                    <Card key={book.id} className="group overflow-hidden border border-slate-200/50 shadow-sm hover:shadow-2xl transition-all duration-500 bg-white rounded-3xl flex flex-col hover:-translate-y-1">
                       
                       {/* VISUEL HEADER */}
                       <div className="h-64 bg-slate-100/80 flex items-center justify-center overflow-hidden relative border-b border-black/5">
                           {book.cover_url ? (
                              <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700" />
                            ) : (
                              <div className="flex flex-col items-center opacity-30 group-hover:opacity-50 transition-opacity">
                                <span className="text-7xl mb-2 grayscale">📓</span>
                              </div>
                            )}

                           <div className="absolute top-4 left-4 z-10 transition-transform group-hover:scale-105">
                              <StatusOverlay status={book.status} />
                           </div>
                       </div>

                       <CardContent className="p-6 flex-1 flex flex-col justify-between">
                           <div>
                              <div className="flex flex-wrap gap-2 mb-3">
                                 {book.status === 'ONLINE' && <Badge className="bg-blue-50 text-blue-700 font-black tracking-widest uppercase text-[9px] border border-blue-200 shadow-inner px-2 py-0.5">🌐 DIGITAL / METADATA</Badge>}
                                 {book.language && <Badge variant="outline" className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 border-slate-200 px-2 py-0.5 shadow-sm">{book.language}</Badge>}
                              </div>
                              <h2 className="text-xl lg:text-2xl font-black text-slate-900 line-clamp-2 leading-tight mb-2 group-hover:text-indigo-600 transition-colors" title={book.title}>{book.title}</h2>
                              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-5 border-l-4 border-indigo-200 pl-3">{book.author || "Auteur Géré"}</p>
                              
                              <p className="text-slate-600 text-sm line-clamp-3 leading-relaxed font-medium mb-6">{book.synopsis || "Il n'y a actuellement aucune description narrative enregistrée pour cet ouvrage dans l'index."}</p>
                           </div>
                           
                           <div className="space-y-4 mt-auto">
                               <div className="flex flex-wrap gap-1.5 pt-4 border-t border-slate-100">
                                  {book.book_categories && book.book_categories.map(bc => (
                                     <Badge key={bc.category_id} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-black tracking-widest uppercase border border-slate-200 shadow-sm transition-colors py-1 cursor-default">#{bc.categories?.name}</Badge>
                                  ))}
                               </div>
                               
                               <div className="flex items-center justify-between mt-5 pt-3">
                                  {book.locations ? (
                                     <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 shadow-inner group-hover:bg-white transition-colors">
                                       <span className="text-sm mr-2 opacity-50 font-black text-slate-400">📍</span>
                                       <span className="text-[10px] font-black text-slate-600 tracking-widest uppercase">{book.locations.shelf}</span>
                                     </div>
                                  ) : <div></div>} {/* spacer if no location to align button right */}

                                  {book.status === 'ONLINE' && book.online_url && (
                                     <a href={book.online_url} target="_blank" rel="noreferrer">
                                       <Button className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-black tracking-widest text-[10px] uppercase rounded-xl shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all outline-none ring-0">Ouvrir Média ↗</Button>
                                     </a>
                                  )}
                               </div>
                           </div>
                       </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
