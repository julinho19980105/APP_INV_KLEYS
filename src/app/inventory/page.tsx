
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Search, Edit2, ArrowDownRight, ArrowUpRight, Maximize2, X, Layers, Trash2, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit, doc, deleteDoc, getDocs, where, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null)
  const [kardexFilter, setKardexFilter] = React.useState("all")
  const [viewType, setViewType] = React.useState<"collection" | "category">("collection")

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code", "asc")) : null, [db])
  const recentMovementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc"), limit(5)) : null, [db])
  const allMovementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc")) : null, [db])

  const { data: products = [], loading: loadingProducts } = useCollection(productsRef)
  const { data: recentMovements = [] } = useCollection(recentMovementsRef)
  const { data: allMovements = [], loading: loadingMovements } = useCollection(allMovementsRef)

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedData = React.useMemo(() => {
    const mainGroups: Record<string, Record<string, any[]>> = {}
    
    filteredProducts.forEach(p => {
      const mainKey = viewType === "collection" ? (p.collection || "SIN COLECCIÓN") : (p.category || "SIN CATEGORÍA")
      const subKey = viewType === "collection" ? (p.category || "SIN CATEGORÍA") : (p.collection || "SIN COLECCIÓN")
      
      if (!mainGroups[mainKey]) mainGroups[mainKey] = {}
      if (!mainGroups[mainKey][subKey]) mainGroups[mainKey][subKey] = []
      
      mainGroups[mainKey][subKey].push(p)
    })

    // Ordenar items dentro de los subgrupos por stock desc
    Object.keys(mainGroups).forEach(mK => {
      Object.keys(mainGroups[mK]).forEach(sK => {
        mainGroups[mK][sK].sort((a, b) => (b.stock || 0) - (a.stock || 0))
      })
    })

    return mainGroups
  }, [filteredProducts, viewType])

  const handleDelete = async (productId: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "products", productId))
      const movementsRef = collection(db, "movements")
      const qIn = query(movementsRef, where("productCode", "==", productId), where("type", "in", ["in", "return"]))
      const snapIn = await getDocs(qIn)
      const batch = writeBatch(db)
      snapIn.forEach(doc => batch.delete(doc.ref))
      await batch.commit()
      toast({ title: "Producto Eliminado", description: "Se borró el producto y sus entradas de inventario." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." })
    }
  }

  const getThumbnailUrl = (url: string) => {
    if (!url || !url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w300`;
  };

  return (
    <div className="space-y-4 -mt-4">
      {/* Cabecera solo buscador */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
          <Input 
            placeholder="Buscar por código o nombre..." 
            className="pl-10 h-10 rounded-xl border-accent/20 bg-white shadow-sm focus:ring-primary font-bold"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl w-full justify-start overflow-hidden border">
          <TabsTrigger value="all" className="rounded-xl px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-black font-headline">STOCK ACTUAL</TabsTrigger>
          <TabsTrigger value="recent" className="rounded-xl px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-black font-headline">RECIENTES</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-black font-headline">HISTORIAL KARDEX</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4 pt-2">
          <div className="flex gap-2 bg-white p-1 rounded-xl border w-fit shadow-sm">
            <Button 
              variant={viewType === 'collection' ? 'default' : 'ghost'} 
              size="sm" 
              className="text-[10px] font-black h-7 rounded-lg"
              onClick={() => setViewType('collection')}
            >
              <LayoutGrid className="w-3 h-3 mr-1" /> VISTA COLECCIÓN
            </Button>
            <Button 
              variant={viewType === 'category' ? 'default' : 'ghost'} 
              size="sm" 
              className="text-[10px] font-black h-7 rounded-lg"
              onClick={() => setViewType('category')}
            >
              <Layers className="w-3 h-3 mr-1" /> VISTA CATEGORÍA
            </Button>
          </div>

          {loadingProducts ? (
            <div className="p-20 text-center text-accent font-black animate-pulse uppercase tracking-widest bg-white rounded-[2rem] border border-dashed">Sincronizando Inventario...</div>
          ) : Object.keys(groupedData).length > 0 ? (
            <Accordion type="multiple" defaultValue={Object.keys(groupedData)} className="space-y-2">
              {Object.entries(groupedData).map(([mainTitle, subGroups]) => (
                <AccordionItem key={mainTitle} value={mainTitle} className="border rounded-2xl bg-white shadow-sm overflow-hidden border-none px-4">
                  <AccordionTrigger className="hover:no-underline py-4 group">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-colors group-data-[state=open]:bg-primary group-data-[state=open]:text-white",
                        viewType === 'category' ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                      )}>
                        {viewType === 'category' ? <Layers className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] font-black text-accent uppercase tracking-widest">{viewType === 'category' ? 'CATEGORÍA DIVA' : 'COLECCIÓN'}</div>
                        <div className="text-sm font-black text-black uppercase">{mainTitle}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2 border-t border-accent/5">
                    <Accordion type="multiple" className="space-y-2 ml-4">
                      {Object.entries(subGroups).map(([subTitle, items]) => (
                        <AccordionItem key={subTitle} value={subTitle} className="border rounded-xl border-accent/10">
                          <AccordionTrigger className="py-2 px-4 hover:no-underline bg-accent/5">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-accent uppercase">{viewType === 'category' ? 'Colección:' : 'Categoría:'}</span>
                              <span className="text-xs font-black text-black uppercase">{subTitle}</span>
                              <Badge variant="outline" className="text-[9px] font-black border-accent/20 bg-white ml-2">{items.length} PRENDAS</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-white hover:bg-white border-b-2">
                                  <TableHead className="w-[60px] font-black uppercase text-[9px] text-accent text-center">Foto</TableHead>
                                  <TableHead className="font-black uppercase text-[9px] text-accent">Detalle</TableHead>
                                  <TableHead className="text-right font-black uppercase text-[9px] text-accent">Precios Diva</TableHead>
                                  <TableHead className="text-center font-black uppercase text-[9px] text-accent">Stock</TableHead>
                                  <TableHead className="text-right font-black uppercase text-[9px] text-accent w-[80px]">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((p) => (
                                  <TableRow key={p.id} className="group transition-colors hover:bg-primary/5">
                                    <TableCell className="text-center">
                                      <button 
                                        onClick={() => p.images?.[0] && setZoomedImage(p.images[0])}
                                        className="w-10 h-10 rounded-lg border border-accent/20 overflow-hidden bg-muted relative shadow-sm hover:scale-110 transition-transform"
                                      >
                                        {p.images && p.images[0] ? (
                                           <img 
                                            src={getThumbnailUrl(p.images[0])} 
                                            alt="" 
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                           />
                                        ) : (
                                          <div className="text-[8px] font-black opacity-20">N/A</div>
                                        )}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-mono text-[9px] font-black text-accent">{p.code}</div>
                                      <div className="font-black text-black text-xs uppercase">{p.name}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="text-[9px] font-black text-black whitespace-nowrap">
                                        F: {p.priceFardo} / M: {p.priceMayor} / <span className="text-primary">U: {p.priceUnidad}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <span className={cn(
                                        "font-black text-xs px-2.5 py-0.5 rounded-full border",
                                        p.stock <= 0 ? "bg-destructive/10 text-destructive border-destructive/20" : p.stock < 10 ? "bg-orange-50 text-orange-500 border-orange-200" : "bg-green-50 text-green-600 border-green-200"
                                      )}>
                                        {p.stock}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7 text-primary hover:bg-primary/10 rounded-lg"
                                          onClick={() => router.push(`/registry?edit=${p.id}`)}
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg">
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent className="rounded-[2rem]">
                                            <AlertDialogHeader>
                                              <AlertDialogTitle className="font-black text-primary">ELIMINAR PRENDA {p.code}</AlertDialogTitle>
                                              <AlertDialogDescription className="text-xs text-black font-bold">
                                                Esta acción borrará el producto y sus ENTRADAS. Las ventas (salidas) se mantienen intactas.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel className="rounded-xl font-bold">CANCELAR</AlertDialogCancel>
                                              <AlertDialogAction className="rounded-xl font-bold bg-destructive text-white hover:bg-destructive/90" onClick={() => handleDelete(p.id)}>ELIMINAR</AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-20 text-black font-black bg-white rounded-[2rem] border border-dashed border-accent/20 uppercase tracking-widest">
              No hay productos para mostrar con este filtro.
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="pt-2">
          <div className="border rounded-[2rem] overflow-hidden bg-white shadow-sm max-w-4xl mx-auto">
            <div className="bg-primary/5 px-8 py-4 border-b">
               <h3 className="font-black text-primary uppercase text-[10px] tracking-widest">Últimos 5 Cambios Industriales</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-black uppercase text-[9px] text-black">Fecha / Hora</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">Prenda</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">Tipo</TableHead>
                  <TableHead className="text-center font-black uppercase text-[9px] text-black">Cantidad</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-[9px] font-black text-black">
                      {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString('es-PE') : ""}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] font-black text-accent">{m.productCode}</TableCell>
                    <TableCell>
                      {m.type === 'in' || m.type === 'return' ? <Badge className="bg-green-500 text-[8px] border-none font-black uppercase">Ingreso</Badge> : <Badge variant="destructive" className="text-[8px] font-black uppercase border-none">Salida</Badge>}
                    </TableCell>
                    <TableCell className="text-center font-black text-sm text-black">{m.quantity}</TableCell>
                    <TableCell className="text-[9px] font-black uppercase text-black">{m.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="movements" className="pt-2 space-y-4">
           <div className="flex justify-end px-2">
              <Select value={kardexFilter} onValueChange={setKardexFilter}>
                <SelectTrigger className="w-[180px] h-8 text-[10px] font-black uppercase rounded-xl border-accent/20 bg-white text-black">
                  <SelectValue placeholder="Filtrar Kardex" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-[10px] uppercase font-black">Todos los Motivos</SelectItem>
                  <SelectItem value="Reposición de Mercadería" className="text-[10px] uppercase font-black">Reposición</SelectItem>
                  <SelectItem value="Stock Inicial / Registro Nuevo" className="text-[10px] uppercase font-black">Stock Inicial</SelectItem>
                  <SelectItem value="Devolución" className="text-[10px] uppercase font-black">Devolución</SelectItem>
                  <SelectItem value="Venta" className="text-[10px] uppercase font-black text-primary">Ventas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-[2rem] overflow-hidden bg-white shadow-sm">
              {loadingMovements ? (
                <div className="p-20 text-center text-primary font-black animate-pulse uppercase tracking-widest">Auditoría en curso...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="font-black uppercase text-[9px] text-primary">Fecha / Hora</TableHead>
                      <TableHead className="font-black uppercase text-[9px] text-primary">Prenda</TableHead>
                      <TableHead className="font-black uppercase text-[9px] text-primary">Operación</TableHead>
                      <TableHead className="text-center font-black uppercase text-[9px] text-primary">Variación</TableHead>
                      <TableHead className="font-black uppercase text-[9px] text-primary">Referencia / Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMovements
                      .filter(m => kardexFilter === 'all' || m.reason.includes(kardexFilter) || (kardexFilter === 'Venta' && m.type === 'out'))
                      .map((m) => (
                      <TableRow key={m.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="text-[9px] font-black text-black">
                          {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString('es-PE') : ""}
                        </TableCell>
                        <TableCell className="font-black text-accent font-mono text-[10px]">{m.productCode}</TableCell>
                        <TableCell>
                          {m.type === 'in' || m.type === 'return' ? (
                            <div className="flex items-center gap-1 text-green-600 font-black text-[9px] uppercase">
                              <ArrowUpRight className="w-3 h-3" /> ENTRADA
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-destructive font-black text-[9px] uppercase">
                              <ArrowDownRight className="w-3 h-3" /> SALIDA
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-black text-sm text-black">
                          {m.type === 'in' || m.type === 'return' ? '+' : '-'}{m.quantity}
                        </TableCell>
                        <TableCell className="text-[9px] font-black uppercase text-black">{m.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomedImage} onOpenChange={(o) => !o && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center rounded-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Imagen Original Drive</DialogTitle>
            <DialogDescription>Visualización Calidad Máxima Diva</DialogDescription>
          </DialogHeader>
          {zoomedImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={zoomedImage.includes('id=') ? zoomedImage.replace('export=view', 'export=download') : zoomedImage} 
                alt="" 
                className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
