import { Link, useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex">
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-extrabold text-xl tracking-tight text-indigo-600">
              Iman<span className="text-foreground">Library</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <Link to="/">
             <Button variant="ghost" size="sm">Catalogue</Button>
          </Link>
          {user ? (
            <>
              {/* Ces boutons n'apparaissent que si la personne est loggée ! */}
              <Link to="/admin">
                <Button variant="outline" size="sm" className="border-indigo-200 hover:bg-indigo-50">Dashboard Admin</Button>
              </Link>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                Déconnexion
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button variant="default" size="sm" className="bg-slate-900">
                Connexion
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
