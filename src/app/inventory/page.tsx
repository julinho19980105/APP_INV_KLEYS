
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Edit2, ArrowDownRight, ArrowUpRight, X, Trash2, MoreVertical, LayoutGrid, Layers } from "lucide-react"
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

  // Cargar configuración de vista
  React.useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem('diva_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.inventoryViewMode) setViewType(parsed.inventoryViewMode)
      }
    }
    loadSettings()
    window.addEventListener('storage', loadSettings)
    return () => window.removeEventListener('storage', loadSettings)
  }, [])

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
      toast({ title: "Producto Eliminado", description: "Se borró el producto y sus entradas." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const getThumbnailUrl = (url: string) => {
    if (!url || !url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w300`;
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
          <Input 
            placeholder="BUSCAR PRENDA..." 
            className="pl-10 h-10 rounded-xl border-black/10 bg-white shadow-sm focus:ring-primary font-black text-black uppercase"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full justify-start overflow-hidden border">
          <TabsTrigger value="all" className="rounded-xl px-8 data-[state=active]:bg-black data-[state=active]:text-white transition-all text-[10px] font-black font-headline uppercase">STOCK ACTUAL</TabsTrigger>
          <TabsTrigger value="recent" className="rounded-xl px-8 data-[state=active]:bg-black data-[state=active]:text-white transition-all text-[10px] font-black font-headline uppercase">RECIENTES</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-8 data-[state=active]:bg-black data-[state=active]:text-white transition-all text-[10px] font-black font-headline uppercase">KARDEX</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4 pt-2">
          <div className="flex items-center gap-2 px-2">
            <Badge variant="outline" className="text-[9px] font-black uppercase px-2 py-0.5 border-black/20 text-black flex items-center gap-1">
              {viewType === 'collection' ? <LayoutGrid className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
              MODO: {viewType === 'collection' ? 'COLECCIÓN' : 'CATEGORÍA'}
            </Badge>
          </div>

          {loadingProducts ? (
            <div className="p-20 text-center text-black font-black animate-pulse uppercase tracking-widest bg-white rounded-[2rem] border border-dashed">Sincronizando Inventario...</div>
          ) : Object.keys(groupedData).length > 0 ? (
            <Accordion type="multiple" defaultValue={Object.keys(groupedData)} className="space-y-2">
              {Object.entries(groupedData).map(([mainTitle, subGroups]) => (
                <AccordionItem key={mainTitle} value={mainTitle} className="border rounded-2xl bg-white shadow-sm overflow-hidden border-none px-4">
                  <AccordionTrigger className="hover:no-underline py-4 px-2 group">
                    <div className="text-sm font-black text-black uppercase tracking-tight">{mainTitle}</div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-0 border-t border-black/5">
                    <Accordion type="multiple" className="space-y-2 mt-2 ml-2">
                      {Object.entries(subGroups).map(([subTitle, items]) => (
                        <AccordionItem key={subTitle} value={subTitle} className="border rounded-xl border-black/5">
                          <AccordionTrigger className="py-2 px-4 hover:no-underline bg-black/5">
                            <span className="text-xs font-black text-black uppercase">{subTitle}</span>
                          </AccordionTrigger>
                          <AccordionContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-white hover:bg-white border-b-2">
                                  <TableHead className="w-[50px] font-black uppercase text-[9px] text-black text-center">FOTO</TableHead>
                                  <TableHead className="font-black uppercase text-[9px] text-black">PRENDA</TableHead>
                                  <TableHead className="text-right font-black uppercase text-[9px] text-black">TARIFAS</TableHead>
                                  <TableHead className="text-center font-black uppercase text-[9px] text-black">STOCK</TableHead>
                                  <TableHead className="text-right font-black uppercase text-[9px] text-black w-[50px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((p) => (
                                  <TableRow key={p.id} className="group transition-colors hover:bg-black/5">
                                    <TableCell className="text-center p-2">
                                      <button 
                                        onClick={() => p.images?.[0] && setZoomedImage(p.images[0])}
                                        className="w-10 h-10 rounded-lg border border-black/10 overflow-hidden bg-muted relative shadow-sm hover:scale-105 transition-transform"
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
                                    <TableCell className="p-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-black text-black/50">{p.code}</span>
                                        <span className="font-black text-black text-xs uppercase truncate max-w-[150px]">{p.name}</span>
                                      </div>
                                      <div className="text-[9px] font-black text-black/40 uppercase mt-0.5">
                                        {viewType === 'collection' ? p.category : p.collection}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right p-2">
                                      <div className="text-[10px] font-black text-black">
                                        F: {p.priceFardo} / M: {p.priceMayor} / <span className="text-primary">U: {p.priceUnidad}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center p-2">
                                      <span className={cn(
                                        "font-black text-xs px-2.5 py-0.5 rounded-full border",
                                        p.stock <= 0 ? "bg-destructive/10 text-destructive border-destructive/20" : p.stock < 10 ? "bg-orange-50 text-orange-500 border-orange-200" : "bg-green-50 text-green-600 border-green-200"
                                      )}>
                                        {p.stock}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right p-2">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-black/10">
                                            <MoreVertical className="w-4 h-4 text-black" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl">
                                          <DropdownMenuItem 
                                            className="text-[10px] font-black uppercase cursor-pointer"
                                            onClick={() => router.push(`/registry?edit=${p.id}`)}
                                          >
                                            <Edit2 className="w-3 h-3 mr-2" /> Editar
                                          </DropdownMenuItem>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <DropdownMenuItem 
                                                className="text-[10px] font-black uppercase cursor-pointer text-destructive focus:text-destructive"
                                                onSelect={(e) => e.preventDefault()}
                                              >
                                                <Trash2 className="w-3 h-3 mr-2" /> Eliminar
                                              </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[2rem]">
                                              <AlertDialogHeader>
                                                <AlertDialogTitle className="font-black text-primary">ELIMINAR PRENDA {p.code}</AlertDialogTitle>
                                                <AlertDialogDescription className="text-xs text-black font-bold">
                                                  Esta acción borrará el producto y sus ENTRADAS. Las ventas registradas se mantienen intactas.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel className="rounded-xl font-bold">CANCELAR</AlertDialogCancel>
                                                <AlertDialogAction className="rounded-xl font-bold bg-destructive text-white hover:bg-destructive/90" onClick={() => handleDelete(p.id)}>ELIMINAR</AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
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
            <div className="text-center py-20 text-black font-black bg-white rounded-[2rem] border border-dashed border-black/10 uppercase tracking-widest">
              No hay productos para mostrar.
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="pt-2">
          <div className="border rounded-[2rem] overflow-hidden bg-white shadow-sm max-w-4xl mx-auto">
            <div className="bg-black/5 px-8 py-4 border-b">
               <h3 className="font-black text-black uppercase text-[10px] tracking-widest">Últimos 5 Movimientos</h3>
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
                    <TableCell className="font-mono text-[10px] font-black text-black">{m.productCode}</TableCell>
                    <TableCell>
                      {m.type === 'in' || m.type === 'return' ? <Badge className="bg-green-600 text-[8px] border-none font-black uppercase">Ingreso</Badge> : <Badge variant="destructive" className="text-[8px] font-black uppercase border-none">Salida</Badge>}
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
                <SelectTrigger className="w-[180px] h-8 text-[10px] font-black uppercase rounded-xl border-black/10 bg-white text-black">
                  <SelectValue placeholder="FILTRAR KARDEX" />
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
                    <TableRow className="bg-black/5">
                      <TableHead className="font-black uppercase text-[9px] text-black">Fecha / Hora</TableHead>
                      <TableHead className="font-black uppercase text-[9px] text-black">Prenda</TableHead>
                      <TableHead className="font-black uppercase text-[9px] text-black">Operación</TableHead>
                      <TableHead className="text-center font-black uppercase text-[9px] text-black">Variación</TableHead>
                      <TableHead className="font-black uppercase text-[9px] text-black">Referencia / Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMovements
                      .filter(m => kardexFilter === 'all' || m.reason.includes(kardexFilter) || (kardexFilter === 'Venta' && m.type === 'out'))
                      .map((m) => (
                      <TableRow key={m.id} className="hover:bg-black/5 transition-colors">
                        <TableCell className="text-[9px] font-black text-black">
                          {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString('es-PE') : ""}
                        </TableCell>
                        <TableCell className="font-black text-black font-mono text-[10px]">{m.productCode}</TableCell>
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
            <DialogTitle>Imagen Drive</DialogTitle>
            <DialogDescription>Zoom Industrial Diva</DialogDescription>
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
