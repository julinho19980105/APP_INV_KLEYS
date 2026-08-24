
"use client"

import * as React from "react"
import { 
  BookOpen, 
  ExternalLink,
  FileText,
  Globe
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export default function CatalogoPage() {
  const db = useFirestore()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

  const links = [
    {
      title: "MENÚ CATÁLOGO PDF",
      url: "https://script.google.com/macros/s/AKfycbwC92DCBZY0rOmJ0MuE6uGgj1cGrzahyDyJZoWrIQQz9xU8BwyX8b3yWQawBt_co7JA/exec",
      icon: FileText,
      color: "bg-red-500"
    },
    {
      title: "CATÁLOGO WEB",
      url: "https://kleys-catalogo.vercel.app/",
      icon: Globe,
      color: "bg-blue-500"
    }
  ]

  return (
    <div className="space-y-8 pt-6 pb-24 max-w-4xl mx-auto px-4 flex flex-col items-center">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-xl shadow-primary/20 mx-auto mb-4" style={{ backgroundColor: brandColor }}>
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-headline font-black text-foreground uppercase tracking-tight">Catálogos Disponibles</h1>
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Acceso a Herramientas de Ventas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {links.map((link) => (
          <Button
            key={link.title}
            className="h-40 rounded-[2.5rem] bg-white border-2 border-primary/10 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-4 group"
            onClick={() => window.open(link.url, '_blank')}
          >
            <div className={`w-14 h-14 rounded-2xl ${link.color} flex items-center justify-center text-white shadow-lg`}>
              <link.icon className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <span className="text-lg font-black text-black uppercase block">{link.title}</span>
              <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest flex items-center justify-center gap-2">
                ABRIR ENLACE <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </Button>
        ))}
      </div>

      <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-dashed border-primary/20 text-center max-w-md w-full">
        <p className="text-[11px] font-medium text-muted-foreground uppercase leading-relaxed">
          Estos enlaces dirigen a las herramientas de visualización actualizadas para tus clientes.
        </p>
      </div>
    </div>
  )
}
