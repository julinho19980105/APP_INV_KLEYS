
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Search, Edit2, ArrowDownRight, ArrowUpRight, Plus, Maximize2, X, History, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null)
  const [kardexFilter, setKardexFilter] = React.useState("all")

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

  // Agrupamiento Industrial: Categoría > Colección > Stock Desc
  const groupedProducts = React.useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {}
    filteredProducts.forEach(p => {
      const cat = p.category || "SIN CATEGORÍA"
      const col = p.collection || "SIN COLECCIÓN"
      if (!groups[cat]) groups[cat] = {}
      if (!groups[cat][col]) groups[cat][col] = []
      groups[cat][col].push(p)
    })

    // Ordenar productos dentro de cada colección por stock desc
    Object.keys(groups).forEach(cat => {
      Object.keys(groups[cat]).forEach(col => {
        groups[cat][col].sort((a, b) => (b.stock || 0) - (a.stock || 0))
      })
    })

    return groups
  }, [filteredProducts])

  const getThumbnailUrl = (url: string) => {
    if (!url || !url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w300`;
  };

  const getZoomUrl = (url: string) => {
    if (!url || !url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w2000`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Inventario Diva</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Segmentación Industrial • Control Kardex</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-accent" />
            <Input 
              placeholder="Buscar por código o nombre..." 
              className="pl-9 rounded-xl border-accent/20 bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button className="rounded-xl bg-primary shadow-lg hover:bg-primary/90" onClick={() => router.push('/registry')}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Operación
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
          <TabsTrigger value="all" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Stock Actual</TabsTrigger>
          <TabsTrigger value="recent" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Recientes (5)</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Historial Kardex</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-8">
          {loadingProducts ? (
            <div className="p-20 text-center text-accent font-bold animate-pulse uppercase tracking-widest bg-white rounded-[2rem]">Sincronizando inventario...</div>
          ) : Object.keys(groupedProducts).length > 0 ? (
            Object.entries(groupedProducts).map(([category, collections]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-2 px-6 py-2 bg-accent/10 rounded-full w-fit">
                   <Layers className="w-4 h-4 text-accent" />
                   <h2 className="text-sm font-black text-accent uppercase tracking-widest">{category}</h2>
                </div>
                
                {Object.entries(collections).map(([collectionName, items]) => (
                  <div key={collectionName} className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none ml-4">
                    <div className="bg-muted/30 px-6 py-2 border-b">
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Colección: {collectionName}</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-accent/5 hover:bg-accent/5">
                          <TableHead className="w-[80px] font-black uppercase text-[10px] text-accent text-center">Icono</TableHead>
                          <TableHead className="font-black uppercase text-[10px] text-accent">Cód / Nombre</TableHead>
                          <TableHead className="text-right font-black uppercase text-[10px] text-accent">Precios Diva</TableHead>
                          <TableHead className="text-center font-black uppercase text-[10px] text-accent">Stock</TableHead>
                          <TableHead className="text-right font-black uppercase text-[10px] text-accent">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((p) => (
                          <TableRow key={p.id} className="group transition-colors hover:bg-primary/5">
                            <TableCell className="flex justify-center">
                              <button 
                                onClick={() => p.images?.[0] && setZoomedImage(p.images[0])}
                                className="w-10 h-10 rounded-xl border border-accent/10 overflow-hidden bg-muted relative shadow-sm hover:scale-110 transition-transform group/img"
                              >
                                {p.images && p.images[0] ? (
                                  <>
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
                                       <Maximize2 className="w-4 h-4 text-white" />
                                     </div>
                                     <img 
                                      src={getThumbnailUrl(p.images[0])} 
                                      alt={p.name} 
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                     />
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-accent/10">
                                     <div className="text-[8px] font-black opacity-20 text-center px-1">NO FOTO</div>
                                  </div>
                                )}
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-[10px] font-bold text-accent">{p.code}</div>
                              <div className="font-bold text-primary text-sm">{p.name}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap">S/ {p.priceFardo} - {p.priceMayor} - <span className="text-primary font-bold">{p.priceUnidad}</span></div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={cn(
                                "font-black text-sm px-3 py-0.5 rounded-full",
                                p.stock <= 0 ? "bg-destructive/10 text-destructive" : p.stock < 10 ? "bg-orange-100 text-orange-500" : "bg-green-100 text-green-600"
                              )}>
                                {p.stock}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-xl transition-all"
                                onClick={() => router.push(`/registry?edit=${p.id}`)}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="text-center py-20 text-muted-foreground font-medium bg-white rounded-[2rem]">
              No hay productos registrados con esos filtros.
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent">
          <div className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none max-w-4xl mx-auto">
            <div className="bg-primary/5 px-8 py-4 border-b">
               <h3 className="font-black text-primary uppercase text-xs tracking-widest">Top 5 Movimientos Recientes</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Prenda</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Tipo</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px]">Cantidad</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-[10px] font-bold text-muted-foreground">
                      {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString('es-PE') : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-black text-accent">{m.productCode}</TableCell>
                    <TableCell>
                      {m.type === 'in' ? <Badge className="bg-green-500 text-[8px]">INGRESO</Badge> : <Badge variant="destructive" className="text-[8px]">SALIDA</Badge>}
                    </TableCell>
                    <TableCell className="text-center font-black">{m.quantity}</TableCell>
                    <TableCell className="text-[10px] font-medium uppercase">{m.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="movements">
           <div className="space-y-4">
            <div className="flex justify-end px-2">
              <Select value={kardexFilter} onValueChange={setKardexFilter}>
                <SelectTrigger className="w-[180px] h-8 text-[10px] font-black uppercase rounded-xl">
                  <SelectValue placeholder="Filtrar por motivo" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-[10px] uppercase">Todos</SelectItem>
                  <SelectItem value="Reposición de Mercadería" className="text-[10px] uppercase">Reposición</SelectItem>
                  <SelectItem value="Stock Inicial / Registro Nuevo" className="text-[10px] uppercase">Stock Inicial</SelectItem>
                  <SelectItem value="Devolución" className="text-[10px] uppercase">Devolución</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none">
              {loadingMovements ? (
                <div className="p-20 text-center text-primary font-bold animate-pulse uppercase tracking-widest">Cargando Historial...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableHead className="font-black uppercase text-[10px] text-primary">Fecha / Hora</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-primary">Prenda</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-primary">Tipo</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] text-primary">Cantidad</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-primary">Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMovements
                      .filter(m => kardexFilter === 'all' || m.reason === kardexFilter)
                      .map((m) => (
                      <TableRow key={m.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="text-[10px] font-medium text-muted-foreground">
                          {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString('es-PE') : ""}
                        </TableCell>
                        <TableCell className="font-bold text-accent font-mono text-xs">{m.productCode}</TableCell>
                        <TableCell>
                          {m.type === 'in' || m.type === 'return' ? (
                            <div className="flex items-center gap-1 text-green-600 font-bold text-[10px]">
                              <ArrowUpRight className="w-3 h-3" /> ENTRADA
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-destructive font-bold text-[10px]">
                              <ArrowDownRight className="w-3 h-3" /> SALIDA
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-black text-base">
                          {m.type === 'in' || m.type === 'return' ? '+' : '-'}{m.quantity}
                        </TableCell>
                        <TableCell className="text-[10px] font-bold uppercase">{m.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomedImage} onOpenChange={(o) => !o && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/90 overflow-hidden flex items-center justify-center rounded-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Zoom de Prenda Diva</DialogTitle>
            <DialogDescription>Visualización en calidad original de Google Drive</DialogDescription>
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
                src={getZoomUrl(zoomedImage)} 
                alt="Vista Zoom Calidad Original" 
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
