
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Edit2, ArrowDownRight, ArrowUpRight, X, Trash2, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit, doc, deleteDoc, getDocs, where, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

// Componente memoizado para evitar re-renderizados pesados y lag
const MemoizedProductList = React.memo(({ 
  groupedData, 
  loading, 
  onZoom, 
  onEdit, 
  onDelete 
}: { 
  groupedData: any, 
  loading: boolean, 
  onZoom: (img: string) => void,
  onEdit: (id: string) => void,
  onDelete: (prod: {id: string, code: string}) => void
}) => {
  if (loading) {
    return <div className="p-20 text-center text-black font-black animate-pulse uppercase tracking-widest bg-white rounded-[2rem] border border-dashed border-black/10">Sincronizando...</div>
  }

  if (Object.keys(groupedData).length === 0) {
    return (
      <div className="text-center py-20 text-black font-black bg-white rounded-[2rem] border border-dashed border-black/10 uppercase tracking-widest">
        No hay productos para mostrar.
      </div>
    )
  }

  const getThumbnailUrl = (url: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
    if (!url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w300`;
  };

  return (
    <Accordion type="multiple" className="space-y-2">
      {Object.entries(groupedData).map(([mainTitle, subGroups]) => (
        <AccordionItem key={mainTitle} value={mainTitle} className="border rounded-2xl bg-white shadow-sm overflow-hidden border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4 px-2 group">
            <div className="text-sm font-black text-black uppercase tracking-tight">{mainTitle}</div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-0 border-t border-black/5">
            <Accordion type="multiple" className="space-y-2 mt-2 ml-2">
              {Object.entries(subGroups as any).map(([subTitle, items]: [string, any]) => (
                <AccordionItem key={subTitle} value={subTitle} className="border rounded-xl border-black/5">
                  <AccordionTrigger className="py-2 px-4 hover:no-underline bg-black/5">
                    <span className="text-xs font-black text-black uppercase">{subTitle}</span>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-white hover:bg-white border-b-2">
                          <TableHead className="w-[50px] font-black uppercase text-[9px] text-black text-center">FOTO</TableHead>
                          <TableHead className="font-black uppercase text-[9px] text-black">PRENDA / TARIFAS</TableHead>
                          <TableHead className="text-center font-black uppercase text-[9px] text-black">STOCK</TableHead>
                          <TableHead className="text-right font-black uppercase text-[9px] text-black w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((p: any) => (
                          <TableRow key={p.id} className="group transition-colors hover:bg-black/5">
                            <TableCell className="text-center p-2">
                              <button 
                                onClick={() => p.images?.[0] && onZoom(p.images[0])}
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
                                  <div className="text-[8px] font-black opacity-20 text-black">N/A</div>
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] font-black text-black/50">{p.code}</span>
                                  <span className="font-black text-black text-xs uppercase truncate max-w-[150px]">{p.name}</span>
                                </div>
                                <div className="text-[9px] font-bold text-black/60 uppercase">
                                  F: {p.priceFardo} / M: {p.priceMayor} / <span className="text-primary font-black">U: {p.priceUnidad}</span>
                                </div>
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
                                    className="text-[10px] font-black uppercase cursor-pointer text-black"
                                    onClick={() => onEdit(p.id)}
                                  >
                                    <Edit2 className="w-3 h-3 mr-2" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-[10px] font-black uppercase cursor-pointer text-destructive focus:text-destructive"
                                    onClick={() => onDelete({id: p.id, code: p.code})}
                                  >
                                    <Trash2 className="w-3 h-3 mr-2" /> Eliminar
                                  </DropdownMenuItem>
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
  )
});

MemoizedProductList.displayName = "MemoizedProductList";

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null)
  const [kardexFilter, setKardexFilter] = React.useState("all")
  const [viewType, setViewType] = React.useState<"collection" | "category">("collection")
  const [productToDelete, setProductToDelete] = React.useState<{id: string, code: string} | null>(null)

  React.useEffect(() => {
    const saved = localStorage.getItem('diva_settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.inventoryViewMode) setViewType(parsed.inventoryViewMode)
    }
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

  // Funciones estables para evitar re-renderizados del componente memoizado
  const onZoom = React.useCallback((img: string) => setZoomedImage(img), [])
  const onEdit = React.useCallback((id: string) => router.push(`/registry?edit=${id}`), [router])
  const onDelete = React.useCallback((prod: {id: string, code: string}) => setProductToDelete(prod), [])

  const confirmDelete = React.useCallback(() => {
    if (!db || !productToDelete) return
    const productId = productToDelete.id
    const productRef = doc(db, "products", productId)
    deleteDoc(productRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productRef.path,
        operation: 'delete'
      }));
    });
    const movementsRef = collection(db, "movements")
    const qIn = query(movementsRef, where("productCode", "==", productToDelete.code), where("type", "in", ["in", "return"]))
    getDocs(qIn).then(snapIn => {
      const batch = writeBatch(db)
      snapIn.forEach(doc => batch.delete(doc.ref))
      batch.commit().catch(() => {});
    });
    toast({ title: "Baja Procesada", description: "Se eliminó el producto y sus entradas." })
    setProductToDelete(null)
  }, [db, productToDelete, toast])

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
          <MemoizedProductList 
            groupedData={groupedData}
            loading={loadingProducts}
            onZoom={onZoom}
            onEdit={onEdit}
            onDelete={onDelete}
          />
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
              <Input 
                placeholder="FILTRAR POR MOTIVO..." 
                className="w-[200px] h-8 text-[10px] font-black uppercase rounded-xl border-black/10 bg-white text-black"
                value={kardexFilter === 'all' ? "" : kardexFilter}
                onChange={e => setKardexFilter(e.target.value || 'all')}
              />
            </div>

            <div className="border rounded-[2rem] overflow-hidden bg-white shadow-sm">
              {loadingMovements ? (
                <div className="p-20 text-center text-primary font-black animate-pulse uppercase tracking-widest">Auditoría...</div>
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
                      .filter(m => kardexFilter === 'all' || m.reason.toLowerCase().includes(kardexFilter.toLowerCase()))
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

      <AlertDialog open={!!productToDelete} onOpenChange={(o) => !o && setProductToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-black uppercase">Eliminar Prenda {productToDelete?.code}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-black font-bold uppercase">
              Esta acción borrará el producto y sus ENTRADAS. Las ventas registradas se mantienen intactas para auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-black">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl font-bold bg-destructive text-white hover:bg-destructive/90 uppercase" onClick={confirmDelete}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
