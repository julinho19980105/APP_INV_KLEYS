
"use client"

import * as React from "react"
import { 
  BookOpen, 
  Image as ImageIcon, 
  LayoutGrid, 
  Layers, 
  Download, 
  Loader2,
  Package
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { toJpeg } from 'html-to-image'
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CatalogoPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const catalogRef = React.useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = React.useState(false)

  // Queries para datos
  const categoriesQuery = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsQuery = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products")) : null, [db])
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])

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
          padding: '20px',
        }
      })
      const link = document.createElement('a')
      link.download = `Catálogo_Diva_${new Date().toLocaleDateString()}.jpg`
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
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Galería de Temporada Diva</p>
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

      <div ref={catalogRef} className="bg-white p-4 rounded-[2rem]">
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="bg-black/5 p-1 rounded-2xl w-full md:w-auto border mb-6">
            <TabsTrigger value="categories" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">
              <Layers className="w-4 h-4 mr-2" /> Categorías
            </TabsTrigger>
            <TabsTrigger value="collections" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">
              <LayoutGrid className="w-4 h-4 mr-2" /> Colecciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {categories.map((cat) => {
                const count = getProductCount('category', cat.name)
                return (
                  <Card key={cat.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all shadow-sm overflow-hidden bg-white">
                    <div className="h-3 w-full" style={{ backgroundColor: brandColor }} />
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Layers className="w-8 h-8 text-black/20" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-black uppercase tracking-tighter">{cat.name}</h3>
                        <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-widest">{count} Prendas</p>
                      </div>
                      <div className="pt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-[8px] font-black uppercase text-black/40">Ver Detalle</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {collections.map((col) => {
                const count = getProductCount('collection', col.name)
                return (
                  <Card key={col.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all shadow-sm overflow-hidden bg-white">
                    <div className="h-3 w-full" style={{ backgroundColor: brandColor }} />
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <LayoutGrid className="w-8 h-8 text-black/20" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-black uppercase tracking-tighter">{col.name}</h3>
                        <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-widest">{count} Diseños</p>
                      </div>
                      <div className="pt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-[8px] font-black uppercase text-black/40">Explorar Temporada</span>
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
      </div>
    </div>
  )
}

function doc(db: any, arg1: string, arg2: string): any {
  const { doc: firestoreDoc } = require("firebase/firestore");
  return firestoreDoc(db, arg1, arg2);
}
