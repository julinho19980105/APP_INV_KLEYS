
"use client"

import * as React from "react"
import { 
  BookOpen, 
  LayoutGrid, 
  Layers, 
  Download, 
  Loader2,
  FileDown
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function CatalogoPage() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

  const categoriesQuery = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsQuery = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), where("stock", ">", 0)) : null, [db])

  const { data: categories = [], loading: loadingCats } = useCollection(categoriesQuery)
  const { data: collections = [], loading: loadingCols } = useCollection(collectionsQuery)
  const { data: allProducts = [] } = useCollection(productsQuery)

  const handleDownloadPDF = async (type: 'category' | 'collection', name: string) => {
    toast({ title: "Generando Catálogo PDF..." })
    // Lógica de generación A4 usando la plantilla técnica...
  }

  if (loadingCats || loadingCols) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin" style={{ color: brandColor }} /></div>

  return (
    <div className="space-y-6 pt-2 pb-24 max-w-6xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border border-black/10"><BookOpen className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">PDF Catálogo</h1><p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Generación Industrial Diva</p></div>
        </div>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full md:w-auto border mb-10">
          <TabsTrigger value="categories" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase"><Layers className="w-4 h-4 mr-2" /> Categorías</TabsTrigger>
          <TabsTrigger value="collections" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase"><LayoutGrid className="w-4 h-4 mr-2" /> Colecciones</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat, idx) => (
              <Card key={cat.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all bg-white overflow-hidden shadow-sm">
                <CardContent className="p-4 md:p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-black flex items-center justify-center relative shadow-lg">
                    <Layers className="w-8 h-8" style={{ color: brandColor }} />
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-black text-[9px] font-black flex items-center justify-center border-2 border-black rounded-full">{idx + 1}</span>
                  </div>
                  <h3 className="text-xs font-black uppercase text-black truncate w-full">{cat.name}</h3>
                  <Button onClick={() => handleDownloadPDF('category', cat.name)} className="w-full h-10 bg-black/5 text-black hover:bg-black hover:text-white rounded-xl text-[9px] font-black uppercase gap-2 transition-all">
                    <FileDown className="w-4 h-4" style={{ color: brandColor }} /> Descargar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="collections">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {collections.map((col, idx) => (
              <Card key={col.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all bg-white overflow-hidden shadow-sm">
                <CardContent className="p-4 md:p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-black flex items-center justify-center relative shadow-lg">
                    <LayoutGrid className="w-8 h-8" style={{ color: brandColor }} />
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-black text-[9px] font-black flex items-center justify-center border-2 border-black rounded-full">{idx + 1}</span>
                  </div>
                  <h3 className="text-xs font-black uppercase text-black truncate w-full">{col.name}</h3>
                  <Button onClick={() => handleDownloadPDF('collection', col.name)} className="w-full h-10 bg-black/5 text-black hover:bg-black hover:text-white rounded-xl text-[9px] font-black uppercase gap-2 transition-all">
                    <FileDown className="w-4 h-4" style={{ color: brandColor }} /> Descargar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
