
"use client"

import * as React from "react"
import { 
  BookOpen, 
  LayoutGrid, 
  Layers, 
  Download, 
  Loader2,
  Package,
  FileDown
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, where, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CatalogoPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [exporting, setExporting] = React.useState<string | null>(null)

  const categoriesQuery = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db]);
  const collectionsQuery = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db]);
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), where("stock", ">", 0)) : null, [db]);
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db]);

  const { data: categories = [], loading: loadingCats } = useCollection(categoriesQuery)
  const { data: collections = [], loading: loadingCols } = useCollection(collectionsQuery)
  const { data: allProducts = [] } = useCollection(productsQuery)
  const { data: companySettings } = useDoc(configDocRef)

  const handleDownloadPDF = async (type: 'category' | 'collection', name: string) => {
    setExporting(name)
    try {
      const filtered = allProducts.filter(p => p[type] === name)
      if (filtered.length === 0) {
        toast({ variant: "destructive", title: "SIN STOCK", description: "No hay productos con stock > 0." })
        return
      }

      // Ordenar: Si descargo Categoría, agrupo por Colección. Si descargo Colección, por Categoría.
      const sorted = [...filtered].sort((a, b) => {
        const key = type === 'category' ? 'collection' : 'category'
        return (a[key] || "").localeCompare(b[key] || "")
      })

      const htmlContent = generateCatalogHTML(sorted, companySettings?.companyName || "Moda Keyti Kids")
      
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
          setExporting(null)
        }, 1000)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "ERROR AL GENERAR PDF" })
      setExporting(null)
    }
  }

  const generateCatalogHTML = (products: any[], companyName: string) => {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; background: #fff; font-family: Arial, sans-serif; }
          .page { width: 210mm; height: 297mm; padding: 8mm; background: #fff; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; }
          .header { height: 13mm; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #d8c7e8; position: relative; margin-bottom: 5mm; }
          .collection { font-size: 8pt; font-weight: 800; text-transform: uppercase; }
          .photos { width: 100%; height: 184mm; display: flex; gap: 4mm; margin-bottom: 5mm; }
          .photo-frame { flex: 1; border: 1px dashed #d8b8e6; border-radius: 5mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          .photo-frame img { max-width: 100%; max-height: 100%; object-fit: contain; }
          .info { border: 1.5px solid #d8c7e8; border-radius: 4mm; display: grid; grid-template-columns: 1.25fr .75fr; min-height: 51mm; }
          .details { padding: 4mm; border-right: 1px solid #eadfea; }
          .product-title { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 2mm; }
          .product-name { font-size: 12pt; font-weight: 900; text-transform: uppercase; }
          .product-code { font-size: 8pt; font-weight: 700; color: #8c6aa8; }
          .detail-line { font-size: 8pt; margin-bottom: 1mm; }
          .prices { padding: 4mm; display: flex; flex-direction: column; gap: 2mm; }
          .price-row { display: flex; justify-content: space-between; padding: 2mm; background: #faf6fc; border-left: 3px solid #d8b8e6; font-size: 8pt; font-weight: 700; border-radius: 2mm; }
          .price-value { font-size: 11pt; font-weight: 900; }
        </style>
      </head>
      <body>
        ${products.map(p => `
          <div class="page">
            <div class="header">
              <div class="collection">${companyName} | ${p.collection || 'General'}</div>
              <div class="collection">${p.category}</div>
            </div>
            <div class="photos">
              <div class="photo-frame">
                <img src="${p.images?.[0] || 'https://placehold.co/900x1200?text=SIN+FOTO'}" />
              </div>
              ${p.images?.[1] ? `<div class="photo-frame"><img src="${p.images[1]}" /></div>` : ''}
            </div>
            <div class="info">
              <div class="details">
                <div class="product-title">
                  <div class="product-name">${p.name}</div>
                  <div class="product-code">${p.code}</div>
                </div>
                <div class="detail-line"><strong>STOCK:</strong> ${p.stock} UNIDADES</div>
                <div class="detail-line"><strong>DETALLE:</strong> ${p.description || 'Prenda de alta calidad Diva Industrial.'}</div>
              </div>
              <div class="prices">
                <div class="price-row"><span>UNIDAD</span><span class="price-value">S/ ${p.priceUnidad}</span></div>
                <div class="price-row"><span>MAYOR</span><span class="price-value">S/ ${p.priceMayor}</span></div>
                <div class="price-row"><span>FARDO</span><span class="price-value">S/ ${p.priceFardo}</span></div>
              </div>
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `
  }

  const brandColor = companySettings?.brandColor || "#FF3399"

  if (loadingCats || loadingCols) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6 pt-2 pb-24 max-w-6xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border border-black/10"><BookOpen className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">PDF Catálogo</h1><p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Generación de Catálogos Diva</p></div>
        </div>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full md:w-auto border mb-10">
          <TabsTrigger value="categories" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase"><Layers className="w-4 h-4 mr-2" /> Categorías</TabsTrigger>
          <TabsTrigger value="collections" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase"><LayoutGrid className="w-4 h-4 mr-2" /> Colecciones</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
            {categories.map((cat, idx) => (
              <Card key={cat.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all bg-white overflow-hidden shadow-sm">
                <CardContent className="p-4 md:p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] bg-black flex items-center justify-center text-white relative shadow-lg">
                    <Layers className="w-8 h-8 md:w-10 md:h-10" /><span className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white" style={{ backgroundColor: brandColor }}>{idx + 1}</span>
                  </div>
                  <h3 className="text-xs md:text-sm font-black uppercase text-black line-clamp-1">{cat.name}</h3>
                  <Button onClick={() => handleDownloadPDF('category', cat.name)} disabled={!!exporting} className="w-full h-10 md:h-12 bg-black/5 text-black hover:bg-black hover:text-white rounded-xl text-[9px] font-black uppercase gap-2 transition-all">
                    {exporting === cat.name ? <Loader2 className="animate-spin w-4 h-4" /> : <FileDown className="w-4 h-4 text-primary" />} Descargar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="collections">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
            {collections.map((col, idx) => (
              <Card key={col.id} className="group rounded-[2rem] border-2 border-black/5 hover:border-black transition-all bg-white overflow-hidden shadow-sm">
                <CardContent className="p-4 md:p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] bg-black flex items-center justify-center text-white relative shadow-lg">
                    <LayoutGrid className="w-8 h-8 md:w-10 md:h-10" /><span className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white" style={{ backgroundColor: brandColor }}>{idx + 1}</span>
                  </div>
                  <h3 className="text-xs md:text-sm font-black uppercase text-black line-clamp-1">{col.name}</h3>
                  <Button onClick={() => handleDownloadPDF('collection', col.name)} disabled={!!exporting} className="w-full h-10 md:h-12 bg-black/5 text-black hover:bg-black hover:text-white rounded-xl text-[9px] font-black uppercase gap-2 transition-all">
                    {exporting === col.name ? <Loader2 className="animate-spin w-4 h-4" /> : <FileDown className="w-4 h-4 text-green-500" />} Descargar
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
