import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    
    // Le call API super propre de Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.status === 400) {
         setErrorMsg("Identifiants incorrects.")
      } else {
         setErrorMsg(error.message)
      }
    } else {
      // Redirection immédiate et sécurisée vers l'espace de commandement
      navigate('/admin')
    }
    setLoading(false)
  }

  return (
    <div className="flex animate-in fade-in zoom-in-95 duration-500 items-center justify-center p-4 min-h-[70vh]">
      <Card className="w-full max-w-md shadow-xl border-indigo-100 shadow-indigo-100/50">
        <CardHeader className="space-y-1 text-center bg-indigo-50/30 border-b pb-6 rounded-t-xl">
          <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900">Institut Iman</CardTitle>
          <CardDescription className="text-indigo-600 font-medium">
            Accès sécurisé à l'intranet
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold tracking-tight text-slate-700">Adresse Email Officielle</label>
              <Input 
                type="email" 
                placeholder="direction@institut.fr" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold tracking-tight text-slate-700">Mot de Passe Administratif</label>
              <Input 
                type="password" 
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 font-mono tracking-widest placeholder:tracking-normal"
              />
            </div>
            {errorMsg && (
              <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-md border border-red-100/50">⚠️ {errorMsg}</p>
            )}
            <Button type="submit" className="w-full h-11 text-base bg-slate-900 hover:bg-indigo-600 transition-colors shadow-md" disabled={loading}>
              {loading ? "Vérification cryptographique..." : "Ouvrir la porte"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
