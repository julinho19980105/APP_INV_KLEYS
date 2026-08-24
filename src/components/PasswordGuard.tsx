
"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, Loader2 } from "lucide-react"

export function PasswordGuard({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = React.useState("")
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const saved = localStorage.getItem("stilo_auth")
    if (saved === "true") {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
    setLoading(false)
  }, [])

  const handleLogin = () => {
    if (password === "900") {
      localStorage.setItem("stilo_auth", "true")
      setIsAuthenticated(true)
    } else {
      alert("Contraseña Incorrecta")
      setPassword("")
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-[2rem] bg-primary flex items-center justify-center shadow-2xl shadow-primary/20">
              <Lock className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Acceso Restringido</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Sistema de Gestión Industrial</p>
          </div>
          <div className="space-y-4">
            <Input 
              type="password" 
              placeholder="CÓDIGO DE ACCESO" 
              className="h-14 bg-white/5 border-white/10 text-white text-center font-black text-xl rounded-2xl focus:ring-primary focus:border-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button 
              className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest"
              onClick={handleLogin}
            >
              Entrar al Sistema
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
