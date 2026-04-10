import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute() {
  const { user } = useAuth()

  // Le videur de boîte de nuit ! 
  // Pas d'user connu en cookie ? Dehors vers /login direct. Pas de discussion.
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Tout est clean, j'ouvre la porte avec l'Outlet qui affiche les composants enfants (La route /admin)
  return <Outlet />
}
