
"use client"

import * as React from "react"
import { 
  BookOpen, 
  ExternalLink,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export default function CatalogoPage() {
  const db = useFirestore()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

  const [loading, setLoading] = React.useState(true)
  const scriptUrl = "https://script.google.com/macros/s/AKfycbwBpGRDSXd-Ujrp0erWr3G0LDDqCLwV7sXYhdpNY6qPN7WrFH1Sd4A9KNKXNomqjHT5/exec"

  return (
    <div className="space-y-6 pt-2 pb-24 max-w-7xl mx-auto px-2 md:px-0 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-primary/10 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-headline font-black text-foreground uppercase tracking-tight">Catálogo Industrial</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Implementación Drive Externa</p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          className="h-12 rounded-2xl border-primary/20 text-primary font-black text-[11px] uppercase gap-3 bg-white shadow-sm hover:bg-primary/5 transition-all"
          onClick={() => window.open(scriptUrl, '_blank')}
        >
          <ExternalLink className="w-4 h-4" /> Abrir en Ventana Nueva
        </Button>
      </div>

      <div className="relative flex-1 w-full rounded-[2.5rem] border-4 border-primary/5 bg-white shadow-2xl overflow-hidden min-h-[500px]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 gap-4">
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: brandColor }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Sincronizando con Drive...</span>
          </div>
        )}
        <iframe 
          src={scriptUrl}
          className="w-full h-full border-none"
          onLoad={() => setLoading(false)}
          title="Catálogo Diva Industrial"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}
