
"use client"

import * as React from "react"
import { 
  BookOpen, 
  LayoutGrid, 
  Layers, 
  FileDown,
  Loader2
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CatalogoPage() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  const companyName = config?.companyName || "DIVA INDUSTRIAL"

  const categoriesQuery = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsQuery = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), where("stock", ">", 0)) : null, [db])

  const { data: categories = [], loading: loadingCats } = useCollection(categoriesQuery)
  const { data: collectionsData = [], loading: loadingCols } = useCollection(collectionsQuery)
  const { data: allProducts = [] } = useCollection(productsQuery)

  const getAvailableCount = (type: 'category' | 'collection', name: string) => {
    return allProducts.filter(p => p[type] === name).length
  }

  const handleDownloadPDF = async (type: 'category' | 'collection', filterName: string) => {
    toast({ title: "Generando Catálogo PDF...", description: "Preparando páginas A4..." })
    
    // Filtrar productos con stock > 0
    const filteredProducts = allProducts.filter(p => p[type] === filterName)
    
    if (filteredProducts.length === 0) {
      toast({ variant: "destructive", title: "Sin productos", description: "No hay modelos con stock disponible." })
      return
    }

    // Ordenar: Si es categoría, ordenar por colección. Si es colección, por categoría.
    const sortedProducts = [...filteredProducts].sort((a, b) => {
      const field = type === 'category' ? 'collection' : 'category'
      return (a[field] || "").localeCompare(b[field] || "")
    })

    // Generar HTML del PDF
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const pagesHtml = sortedProducts.map(p => `
      <div class="page">
        <div class="header">
          <div class="collection">COLECCIÓN: ${p.collection || 'GENERAL'}</div>
          <div class="category">CATEGORÍA: ${p.category || 'GENERAL'}</div>
        </div>
        <div class="photos ${p.images?.length >= 3 ? 'three' : p.images?.length === 1 ? 'one' : ''}">
          ${(p.images || []).slice(0, 3).map(img => `
            <div class="photo-frame">
              <img src="${img}" alt="Producto">
            </div>
          `).join('')}
          ${(!p.images || p.images.length === 0) ? '<div class="photo-frame"><div style="opacity:0.1;font-weight:900;font-size:40px">SIN IMAGEN</div></div>' : ''}
        </div>
        <div class="info">
          <div class="details">
            <div class="product-title">
              <div class="product-name">${p.name}</div>
              <div class="product-code">${p.code}</div>
            </div>
            <div class="detail-line"><span class="detail-label">ESTADO:</span> DISPONIBLE</div>
            <div class="extra-text">${p.description || 'Sin descripción adicional.'}</div>
          </div>
          <div class="prices">
            <div class="price-title">PRECIOS</div>
            <div class="price-row"><span>FARDO</span><span class="price-value">S/ ${p.priceFardo || 0}</span></div>
            <div class="price-row"><span>MAYOR</span><span class="price-value">S/ ${p.priceMayor || 0}</span></div>
            <div class="price-row"><span>UNIDAD</span><span class="price-value">S/ ${p.priceUnidad || 0}</span></div>
          </div>
        </div>
      </div>
    `).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Catálogo ${companyName}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; background: #eee; font-family: sans-serif; }
            .page { width: 210mm; height: 297mm; margin: 0 auto; padding: 8mm; background: #fff; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; }
            .header { height: 13mm; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #ddd; position: relative; }
            .collection, .category { font-size: 8pt; font-weight: 700; text-transform: uppercase; }
            .photos { width: 100%; height: 184mm; margin-top: 5mm; display: flex; gap: 4mm; }
            .photo-frame { flex: 1; position: relative; border: 1.5px dashed #ccc; border-radius: 5mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .photo-frame img { width: 100%; height: 100%; object-fit: contain; }
            .photos.one .photo-frame:nth-child(n+2) { display: none; }
            .photos.three { display: grid; grid-template-columns: 1.2fr .8fr; grid-template-rows: 1fr 1fr; }
            .photos.three .photo-frame:first-child { grid-row: 1 / 3; }
            .info { width: 100%; min-height: 51mm; margin-top: 5mm; border: 1.5px solid #ddd; border-radius: 4mm; display: grid; grid-template-columns: 1.25fr .75fr; overflow: hidden; }
            .details { padding: 4mm 5mm; border-right: 1px solid #eee; display: flex; flex-direction: column; justify-content: center; }
            .product-title { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 2mm; }
            .product-name { font-size: 12pt; font-weight: 900; text-transform: uppercase; }
            .product-code { font-size: 8pt; font-weight: 700; color: ${brandColor}; }
            .detail-line { font-size: 8pt; margin-bottom: 1mm; }
            .detail-label { font-weight: 800; }
            .extra-text { margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #eee; font-size: 8pt; color: #666; }
            .prices { padding: 4mm; display: flex; flex-direction: column; justify-content: center; gap: 2mm; }
            .price-title { font-size: 7pt; font-weight: 900; color: ${brandColor}; text-transform: uppercase; }
            .price-row { display: flex; justify-content: space-between; align-items: center; padding: 2mm; background: #f9f9f9; border-left: 3px solid ${brandColor}; font-size: 8pt; font-weight: 700; }
            .price-value { font-size: 11pt; font-weight: 900; }
            @media print { body { background: #fff; } .page { margin: 0; box-shadow: none; } }
          </style>
        </head>
        <body>${pagesHtml}</body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
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
            {categories.map((cat) => {
              const count = getAvailableCount('category', cat.name)
              return (
                <Card key={cat.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all bg-white overflow-hidden shadow-sm">
                  <CardContent className="p-4 md:p-8 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-black flex items-center justify-center relative shadow-lg">
                      <Layers className="w-8 h-8" style={{ color: brandColor }} />
                      <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-black text-[10px] font-black flex items-center justify-center border-2 border-black rounded-full">{count}</span>
                    </div>
                    <h3 className="text-[10px] font-black uppercase text-black truncate w-full">{cat.name}</h3>
                    <Button onClick={() => handleDownloadPDF('category', cat.name)} className="w-full h-10 bg-black/5 text-black hover:bg-black hover:text-white rounded-xl text-[9px] font-black uppercase gap-2 transition-all">
                      <FileDown className="w-4 h-4" style={{ color: brandColor }} /> Descargar
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="collections">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {collectionsData.map((col) => {
              const count = getAvailableCount('collection', col.name)
              return (
                <Card key={col.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all bg-white overflow-hidden shadow-sm">
                  <CardContent className="p-4 md:p-8 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-black flex items-center justify-center relative shadow-lg">
                      <LayoutGrid className="w-8 h-8" style={{ color: brandColor }} />
                      <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-black text-[10px] font-black flex items-center justify-center border-2 border-black rounded-full">{count}</span>
                    </div>
                    <h3 className="text-[10px] font-black uppercase text-black truncate w-full">{col.name}</h3>
                    <Button onClick={() => handleDownloadPDF('collection', col.name)} className="w-full h-10 bg-black/5 text-black hover:bg-black hover:text-white rounded-xl text-[9px] font-black uppercase gap-2 transition-all">
                      <FileDown className="w-4 h-4" style={{ color: brandColor }} /> Descargar
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
