
"use client"

import * as React from "react"
import { 
  BookOpen, 
  LayoutGrid, 
  Layers, 
  Download, 
  Loader2,
  Package,
  Sparkles
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc } from "firebase/firestore"
import { toJpeg } from 'html-to-image'
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CatalogoPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const catalogRef = React.useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = React.useState(false)

  // Queries para datos - Corregido para evitar FirebaseError
  const categoriesQuery = React.useMemo(() => {
    if (!db) return null;
    return query(collection(db, "categories"), orderBy("name"));
  }, [db]);

  const collectionsQuery = React.useMemo(() => {
    if (!db) return null;
    return query(collection(db, "collections"), orderBy("name"));
  }, [db]);

  const productsQuery = React.useMemo(() => {
    if (!db) return null;
    return query(collection(db, "products"));
  }, [db]);

  const configDocRef = React.useMemo(() => {
    if (!db) return null;
    return doc(db, "config", "global");
  }, [db]);

  const { data: categories = [], loading: loadingCats } = useCollection(categoriesQuery)
  const { data: collections = [], loading: loadingCols } = useCollection(collectionsQuery)
  const { data: products = [] } = useCollection(productsQuery)
  const { data: companySettings } = useDoc(configDocRef)

  const handleExport = async () => {
    if (!catalogRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toJpeg(catalogRef.current, { 
        quality: 0.95, 
        backgroundColor: '#ffffff',
        style: {
          padding: '40px',
        }
      })
      const link = document.createElement('a')
      link.download = `PDF_Catálogo_Diva_${new Date().toLocaleDateString()}.jpg`
      link.href = dataUrl
      link.click()
      toast({ title: "CATÁLOGO EXPORTADO", description: "Imagen generada con éxito." })
    } catch (err) {
      toast({ variant: "destructive", title: "ERROR AL EXPORTAR" })
    } finally {
      setExporting(false)
    }
  }

  const getProductCount = (type: 'category' | 'collection', name: string) => {
    return products.filter(p => p[type] === name).length
  }

  const brandColor = companySettings?.brandColor || "#FF3399"
  const companyName = companySettings?.companyName || "Diva Industrial"

  if (loadingCats || loadingCols) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-2 pb-24 max-w-6xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border border-black/10">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">PDF Catálogo</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Identidad de Temporada Diva</p>
          </div>
        </div>
        <Button 
          onClick={handleExport} 
          disabled={exporting}
          className="h-12 px-8 bg-black text-white font-black rounded-xl shadow-lg active:scale-95 transition-all uppercase text-[10px] tracking-widest"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />} 
          Exportar Vista
        </Button>
      </div>

      <div ref={catalogRef} className="bg-white p-8 rounded-[2.5rem] border shadow-xl">
        <div className="mb-10 text-center space-y-2">
            <h2 className="text-4xl font-headline font-black uppercase text-black tracking-tighter">{companyName}</h2>
            <div className="h-1 w-24 bg-primary mx-auto rounded-full" style={{ backgroundColor: brandColor }} />
        </div>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="bg-black/5 p-1 rounded-2xl w-full md:w-auto border mb-10">
            <TabsTrigger value="categories" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">
              <Layers className="w-4 h-4 mr-2" /> Categorías
            </TabsTrigger>
            <TabsTrigger value="collections" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">
              <LayoutGrid className="w-4 h-4 mr-2" /> Colecciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {categories.map((cat, idx) => {
                const count = getProductCount('category', cat.name)
                return (
                  <Card key={cat.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all shadow-sm overflow-hidden bg-white">
                    <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-[2rem] bg-black flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                          <Layers className="w-10 h-10 text-white" />
                        </div>
                        <span className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-black text-xs border-4 border-white" style={{ backgroundColor: brandColor }}>
                          {idx + 1}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-black text-black uppercase tracking-tighter leading-tight">{cat.name}</h3>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]" style={{ color: brandColor }}>{count} Prendas en Stock</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {categories.length === 0 && (
                <div className="col-span-full py-24 text-center">
                   <Package className="w-12 h-12 mx-auto opacity-10 mb-4" />
                   <span className="text-[10px] font-black uppercase text-black/20 tracking-widest">Sin categorías registradas</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="collections">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {collections.map((col, idx) => {
                const count = getProductCount('collection', col.name)
                return (
                  <Card key={col.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all shadow-sm overflow-hidden bg-white">
                    <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-[2rem] bg-black flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                          <LayoutGrid className="w-10 h-10 text-white" />
                        </div>
                        <span className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-black text-xs border-4 border-white" style={{ backgroundColor: brandColor }}>
                          {idx + 1}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-black text-black uppercase tracking-tighter leading-tight">{col.name}</h3>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]" style={{ color: brandColor }}>{count} Diseños Activos</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {collections.length === 0 && (
                <div className="col-span-full py-24 text-center">
                   <Package className="w-12 h-12 mx-auto opacity-10 mb-4" />
                   <span className="text-[10px] font-black uppercase text-black/20 tracking-widest">Sin colecciones registradas</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-20 pt-10 border-t border-black/5 text-center">
            <div className="flex items-center justify-center gap-2 opacity-20">
                <Sparkles className="w-4 h-4" />
                <span className="text-[8px] font-black uppercase tracking-[0.5em]">Diva Industrial Ecosystem</span>
            </div>
        </div>
      </div>
    </div>
  )
}
