
"use client"

import * as React from "react"
import { 
  BookOpen, 
  LayoutGrid, 
  Layers, 
  FileDown,
  Loader2,
  RefreshCcw
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { getCatalogFromDrive } from "@/services/sheets-service"

export default function CatalogoPage() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  const companyName = config?.companyName || "DIVA INDUSTRIAL"

  const [products, setProducts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadCatalog = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCatalogFromDrive()
      setProducts(data)
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar con el catálogo en Drive." })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const categories = React.useMemo(() => {
    const names = Array.from(new Set(products.map(p => p.category))).filter(Boolean)
    return names.sort().map(name => ({ id: name, name }))
  }, [products])

  const collections = React.useMemo(() => {
    const names = Array.from(new Set(products.map(p => p.collection))).filter(Boolean)
    return names.sort().map(name => ({ id: name, name }))
  }, [products])

  const getCount = (type: 'category' | 'collection', name: string) => {
    return products.filter(p => p[type] === name).length
  }

  const handleDownloadPDF = async (type: 'category' | 'collection', filterName: string) => {
    toast({ title: "Generando Catálogo PDF...", description: "Cargando datos desde Drive..." })
    
    const filteredProducts = products.filter(p => p[type] === filterName)
    
    if (filteredProducts.length === 0) {
      toast({ variant: "destructive", title: "Sin productos", description: "No hay modelos disponibles." })
      return
    }

    const sortedProducts = [...filteredProducts].sort((a, b) => {
      const field = type === 'category' ? 'collection' : 'category'
      return (a[field] || "").localeCompare(b[field] || "")
    })

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const pagesHtml = sortedProducts.map(p => `
      <div class="page">
        <div class="header">
          <div class="collection" style="color: ${brandColor}">COL: ${p.collection || 'GENERAL'}</div>
          <div class="company-name-print">${companyName}</div>
          <div class="category" style="color: ${brandColor}">CAT: ${p.category || 'GENERAL'}</div>
        </div>
        
        <div class="photos ${p.images?.length >= 3 ? 'three' : p.images?.length === 2 ? 'two' : 'one'}">
          ${(p.images || []).slice(0, 3).map(img => `
            <div class="photo-frame">
              <img src="${img}" alt="Producto" crossorigin="anonymous">
            </div>
          `).join('')}
          ${(!p.images || p.images.length === 0) ? `
            <div class="photo-frame">
              <div class="no-image">SIN IMAGEN</div>
            </div>
          ` : ''}
        </div>

        <div class="info">
          <div class="details">
            <div class="product-title">
              <div class="product-name">${p.name}</div>
              <div class="product-code" style="color: ${brandColor}">${p.code}</div>
            </div>
            ${p.description ? `<div class="extra-text">${p.description}</div>` : '<div class="extra-text"></div>'}
          </div>
          <div class="prices">
            <div class="price-title" style="color: ${brandColor}">TARIFARIO INDUSTRIAL</div>
            <div class="price-row" style="border-left-color: ${brandColor}"><span>FARDO</span><span class="price-value">S/ ${p.priceFardo || 0}</span></div>
            <div class="price-row" style="border-left-color: ${brandColor}"><span>MAYOR</span><span class="price-value">S/ ${p.priceMayor || 0}</span></div>
            <div class="price-row" style="border-left-color: ${brandColor}"><span>UNIDAD</span><span class="price-value">S/ ${p.priceUnidad || 0}</span></div>
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
            body { margin: 0; background: #e5e5e5; font-family: Arial, sans-serif; }
            .page { 
              width: 210mm; 
              height: 297mm; 
              margin: 15px auto; 
              padding: 10mm; 
              background: #fff; 
              display: flex; 
              flex-direction: column; 
              page-break-after: always;
              position: relative;
            }
            .header { 
              height: 15mm; 
              display: flex; 
              align-items: center; 
              justify-content: space-between; 
              border-bottom: 2px solid ${brandColor}33; 
              margin-bottom: 5mm;
            }
            .collection, .category { 
              font-size: 8pt; 
              font-weight: 900; 
              text-transform: uppercase; 
              width: 30%;
            }
            .category { text-align: right; }
            .company-name-print {
              font-size: 16pt;
              font-weight: 900;
              color: ${brandColor};
              text-align: center;
              flex: 1;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            
            .photos { 
              width: 100%; 
              height: 190mm; 
              display: flex; 
              gap: 4mm;
              margin-bottom: 5mm;
            }
            .photo-frame { 
              flex: 1; 
              position: relative; 
              border: 1.5px dashed ${brandColor}33; 
              border-radius: 5mm; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              overflow: hidden;
              background: #fafafa;
            }
            .photo-frame img { 
              max-width: 95%; 
              max-height: 95%; 
              object-fit: contain; 
            }
            .no-image { opacity: 0.2; font-weight: 900; font-size: 20pt; text-align: center; }

            .photos.two .photo-frame { width: 50%; }
            .photos.three { display: grid; grid-template-columns: 1.2fr 0.8fr; grid-template-rows: 1fr 1fr; }
            .photos.three .photo-frame:first-child { grid-row: 1 / 3; }

            .info { 
              width: 100%; 
              min-height: 55mm; 
              margin-top: auto;
              border: 2.5px solid ${brandColor}22; 
              border-radius: 5mm; 
              display: grid; 
              grid-template-columns: 1.3fr 0.7fr; 
              overflow: hidden;
              background: #fff;
            }
            .details { 
              padding: 6mm; 
              border-right: 1.5px solid ${brandColor}11; 
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
            }
            .product-title { 
              display: flex; 
              align-items: baseline; 
              gap: 4mm; 
              margin-bottom: 3mm; 
            }
            .product-name { font-size: 14pt; font-weight: 900; text-transform: uppercase; color: #000; }
            .product-code { font-size: 9pt; font-weight: 900; }
            .extra-text { 
              margin-top: 2mm; 
              padding-top: 3mm; 
              border-top: 1px solid #eee; 
              font-size: 8pt; 
              color: #666; 
              line-height: 1.4;
              min-height: 15mm;
            }
            .prices { 
              padding: 6mm; 
              background: #fafafa;
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
              gap: 2mm; 
            }
            .price-title { font-size: 7pt; font-weight: 900; text-transform: uppercase; margin-bottom: 1mm; }
            .price-row { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              padding: 2mm 3mm; 
              background: #fff; 
              border-left: 4px solid; 
              border-radius: 2mm;
              font-size: 8pt; 
              font-weight: 700; 
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .price-value { font-size: 11pt; font-weight: 950; color: #000; }
            
            @media print { 
              body { background: #fff; } 
              .page { margin: 0; border: none; }
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.addEventListener('load', () => {
              const images = Array.from(document.querySelectorAll('img'));
              if (images.length === 0) { window.print(); return; }
              const loadPromises = images.map(img => {
                return new Promise((resolve) => {
                  if (img.complete) resolve();
                  else {
                    img.onload = () => resolve();
                    img.onerror = () => {
                      const err = document.createElement('div');
                      err.style.cssText = 'color:red; font-size:7pt; font-weight:900; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.8);';
                      err.innerText = 'ERROR CARGA';
                      img.parentNode.appendChild(err);
                      resolve();
                    };
                  }
                });
              });
              Promise.all(loadPromises).then(() => {
                setTimeout(() => { window.print(); }, 800);
              });
            });
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin" style={{ color: brandColor }} /></div>

  return (
    <div className="space-y-6 pt-2 pb-24 max-w-6xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border border-black/10"><BookOpen className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">PDF Catálogo</h1><p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Sincronizado desde Drive</p></div>
        </div>
        <Button onClick={loadCatalog} variant="outline" className="h-10 rounded-xl font-black text-[10px] uppercase gap-2">
          <RefreshCcw className="w-4 h-4" style={{ color: brandColor }} /> Actualizar Datos
        </Button>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full md:w-auto border mb-10">
          <TabsTrigger value="categories" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase"><Layers className="w-4 h-4 mr-2" /> Categorías</TabsTrigger>
          <TabsTrigger value="collections" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase"><LayoutGrid className="w-4 h-4 mr-2" /> Colecciones</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const count = getCount('category', cat.name)
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
            {collections.map((col) => {
              const count = getCount('collection', col.name)
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
