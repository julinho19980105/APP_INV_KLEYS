
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
import { Search, Edit2, ArrowDownRight, ArrowUpRight, Plus, Maximize2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null)

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code", "asc")) : null, [db])
  const movementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc")) : null, [db])

  const { data: products = [], loading: loadingProducts } = useCollection(productsRef)
  const { data: movements = [], loading: loadingMovements } = useCollection(movementsRef)

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Calidad Original • Almacenamiento Seguro</p>
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
            <Plus className="w-4 h-4 mr-2" /> Nueva Prenda
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
          <TabsTrigger value="all" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Stock Actual</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Historial Kardex</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none min-h-[400px]">
          {loadingProducts ? (
            <div className="p-20 text-center text-accent font-bold animate-pulse uppercase tracking-widest">Sincronizando inventario...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-accent/5 hover:bg-accent/5">
                  <TableHead className="w-[80px] font-black uppercase text-[10px] text-accent">Icono</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-accent">Cód / Nombre</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-accent">Categoría</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] text-accent">Fardo / Mayor / Unid</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] text-accent">Stock</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] text-accent">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length > 0 ? filteredProducts.map((p) => (
                  <TableRow key={p.id} className="group transition-colors hover:bg-primary/5">
                    <TableCell>
                      <button 
                        onClick={() => {
                          if (p.images && p.images[0]) {
                            setZoomedImage(p.images[0]);
                          }
                        }}
                        className="w-12 h-12 rounded-2xl border border-accent/10 overflow-hidden bg-muted relative shadow-sm hover:scale-110 transition-transform group/img"
                        title="Ver Calidad Original (Zoom)"
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
                      <div className="font-mono text-xs font-bold text-accent">{p.code}</div>
                      <div className="font-bold text-primary group-hover:text-primary transition-colors">{p.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-widest bg-accent/10 text-accent border-none">
                        {p.category || 'Sin Cat.'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">S/ {p.priceFardo} - {p.priceMayor} - <span className="text-primary font-bold">{p.priceUnidad}</span></div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-black text-base px-3 py-1 rounded-full",
                        p.stock === 0 ? "bg-destructive/10 text-destructive" : p.stock < 10 ? "bg-orange-100 text-orange-500" : "bg-green-100 text-green-600"
                      )}>
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-primary hover:bg-primary/10 rounded-xl transition-all hover:scale-110"
                        onClick={() => router.push(`/registry?edit=${p.id}`)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">
                      No hay productos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="movements">
           <div className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none">
            {loadingMovements ? (
              <div className="p-20 text-center text-primary font-bold animate-pulse uppercase tracking-widest">Cargando Historial...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                    <TableHead className="font-black uppercase text-[10px] text-primary">Fecha</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-primary">Prenda</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-primary">Tipo</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] text-primary">Cantidad</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-primary">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length > 0 ? movements.map((m) => (
                    <TableRow key={m.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString() : ""}
                      </TableCell>
                      <TableCell className="font-bold text-accent font-mono">{m.productCode}</TableCell>
                      <TableCell>
                        {m.type === 'in' ? (
                          <div className="flex items-center gap-1 text-green-600 font-bold text-xs">
                            <ArrowUpRight className="w-3 h-3" /> INGRESO
                          </div>
                        ) : m.type === 'out' ? (
                          <div className="flex items-center gap-1 text-destructive font-bold text-xs">
                            <ArrowDownRight className="w-3 h-3" /> SALIDA
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-accent font-bold text-xs">
                            <ArrowUpRight className="w-3 h-3" /> DEVOLUCIÓN
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-black text-lg">
                        {m.type === 'in' || m.type === 'return' ? '+' : '-'}{m.quantity}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{m.reason}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium">
                        Sin movimientos registrados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomedImage} onOpenChange={(o) => !o && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/90 overflow-hidden flex items-center justify-center rounded-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Zoom de Prenda Diva</DialogTitle>
            <DialogDescription>Imagen en calidad original de Google Drive</DialogDescription>
          </DialogHeader>
          {zoomedImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                aria-label="Cerrar vista ampliada"
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
