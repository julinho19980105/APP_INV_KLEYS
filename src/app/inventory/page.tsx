
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { 
  Search, 
  Edit2, 
  Trash2, 
  MoreVertical, 
  Calendar, 
  LayoutGrid, 
  Layers, 
  ImageIcon, 
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, getDocs, serverTimestamp, updateDoc, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { syncCatalogToDrive } from "@/services/sheets-service"

function getDriveThumb(url: string, size: number = 400) {
  if (!url || !url.includes('drive.google.com')) return url;
  let fileId = '';
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) fileId = idMatch[1];
  else {
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch && dMatch[1]) fileId = dMatch[1];
  }
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}` : url;
}

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [zoomImage, setZoomImage] = React.useState<string | null>(null)
  const [syncing, setSyncing] = React.useState(false)

  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  const viewType = config?.inventoryViewMode || "collection"
  
  const lastDriveSync = React.useMemo(() => {
    if (!config?.lastDriveSync) return new Date(0);
    return config.lastDriveSync.toDate ? config.lastDriveSync.toDate() : new Date(config.lastDriveSync);
  }, [config])
  
  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code", "asc")) : null, [db])
  
  // OPTIMIZACIÓN: Solo cargar los últimos 100 movimientos de stock
  const movementsRef = React.useMemo(() => db ? query(
    collection(db, "movements"), 
    orderBy("timestamp", "desc"),
    limit(100)
  ) : null, [db])
  
  const { data: products = [] } = useCollection(productsRef)
  const { data: movements = [] } = useCollection(movementsRef)

  const needsSync = React.useMemo(() => {
    if (products.length === 0) return false
    return products.some(p => {
      const updatedAt = p.updatedAt?.toDate ? p.updatedAt.toDate() : new Date(p.updatedAt || 0)
      return updatedAt > lastDriveSync
    })
  }, [products, lastDriveSync])

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  const groupedProducts = React.useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredProducts.forEach(p => {
      const key = (p[viewType] || "SIN CLASIFICAR").toUpperCase()
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredProducts, viewType])

  const groupedMovements = React.useMemo(() => {
    const groups: Record<string, { label: string, items: any[] }> = {}
    movements.forEach(m => {
      const date = m.timestamp?.toDate ? m.timestamp.toDate() : new Date()
      const dayLabel = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
      if (!groups[dayLabel]) groups[dayLabel] = { label: dayLabel, items: [] }
      groups[dayLabel].items.push(m)
    })
    return Object.values(groups)
  }, [movements])

  const handleManualSync = async () => {
    if (!db || syncing) return
    setSyncing(true)
    try {
      toast({ title: "Sincronizando...", description: "Actualizando Google Sheets..." })
      await syncCatalogToDrive(products)
      await updateDoc(doc(db, "config", "global"), {
        lastDriveSync: serverTimestamp()
      })
      toast({ title: "Nube Actualizada", description: "Sheets e Inventario al día." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error de Sincronización", description: e.message || "No se pudo actualizar Drive." })
    } finally {
      setSyncing(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "products", id))
      toast({ title: "BAJA PROCESADA" })
    } catch (e) { toast({ variant: "destructive", title: "ERROR" }) }
  }

  return (
    <div className="space-y-6 pt-4 pb-20 max-w-full px-2 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-primary/10 pb-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <Package className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-headline font-black text-foreground uppercase tracking-tight">Stock Maestro</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">
              Vista por {viewType === 'collection' ? 'Colección' : 'Categoría'} · Diva Boutique
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row w-full md:w-auto gap-4">
          <Button 
            onClick={handleManualSync}
            disabled={syncing}
            className={cn(
              "h-12 px-6 rounded-2xl font-black text-[10px] uppercase gap-3 transition-all border-none shadow-lg",
              needsSync 
                ? "bg-red-500 text-white animate-pulse hover:bg-red-600" 
                : "bg-primary text-white hover:opacity-90"
            )}
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : needsSync ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {syncing ? "Sincronizando..." : needsSync ? "Sincronizar Nube" : "Catálogo al Día"}
          </Button>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-4 h-4 w-4" style={{ color: brandColor }} />
            <Input 
              placeholder="BUSCAR PRENDA..." 
              className="pl-12 h-12 rounded-2xl border-primary/10 font-black text-xs uppercase shadow-sm bg-white focus:ring-primary"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-secondary p-1 rounded-2xl w-full md:w-auto justify-start border-none mb-6">
          <TabsTrigger value="all" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] font-black uppercase tracking-widest">Almacén Central</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] font-black uppercase tracking-widest">Kardex de Stock (Recientes)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-12">
          {groupedProducts.map(([groupName, items]) => (
            <div key={groupName} className="space-y-4">
              <div className="flex items-center gap-3 px-6 py-2.5 text-white rounded-2xl w-fit shadow-md" style={{ backgroundColor: brandColor }}>
                {viewType === 'collection' ? <LayoutGrid className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                <span className="text-[12px] font-black uppercase tracking-[0.1em]">{groupName}</span>
              </div>
              
              <div className="border border-primary/5 rounded-[2.5rem] bg-white shadow-xl overflow-x-auto scrollbar-hide">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="bg-secondary/50 hover:bg-secondary/50 border-none h-14">
                      <TableHead className="font-black uppercase text-[10px] text-primary pl-10">Prenda Diva / DNI</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-primary">Tarifario Industrial</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-primary text-center">Disponible</TableHead>
                      <TableHead className="w-20 pr-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(p => (
                      <TableRow key={p.id} className="hover:bg-primary/[0.02] transition-colors border-b last:border-0 h-20">
                        <TableCell className="pl-10 py-4">
                          <div className="flex items-center gap-5">
                            <div className="flex gap-1.5 shrink-0">
                              {(p.images || []).length > 0 ? (p.images || []).slice(0, 3).map((img: string, idx: number) => (
                                <div 
                                  key={idx} 
                                  className="w-12 h-12 rounded-xl border border-primary/10 overflow-hidden bg-secondary cursor-pointer hover:ring-2 hover:ring-primary transition-all shadow-sm"
                                  onClick={() => setZoomImage(img)}
                                >
                                  <img src={getDriveThumb(img, 400)} className="w-full h-full object-cover" alt="foto" />
                                </div>
                              )) : (
                                <div className="w-12 h-12 rounded-xl border border-dashed border-primary/20 flex items-center justify-center bg-secondary">
                                  <ImageIcon className="w-6 h-6 text-primary/20" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-[14px] text-foreground uppercase leading-none tracking-tight">{p.name}</span>
                              <span className="font-black text-[10px] text-primary/40 uppercase tracking-widest mt-1.5">{p.code}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col text-[11px] uppercase gap-0.5">
                            <span className="font-medium text-muted-foreground">F: {p.priceFardo} · M: {p.priceMayor}</span>
                            <span className="font-black text-primary">UNIT: S/ {p.priceUnidad}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <div className={cn(
                            "font-black text-[12px] px-5 py-2 rounded-2xl inline-flex flex-col items-center justify-center min-w-[85px] shadow-sm border",
                            p.stock <= 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-primary/5 text-primary border-primary/10"
                          )}>
                            <span>{p.stock}</span>
                            <span className="text-[8px] font-bold uppercase opacity-60">unidades</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-10 py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-primary/10 transition-all"><MoreVertical className="w-5 h-5 text-primary" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-[1.5rem] p-3 shadow-2xl border-primary/10 w-48">
                              <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 cursor-pointer p-4 rounded-xl hover:bg-primary/5 focus:bg-primary/5" onClick={() => router.push(`/registry?edit=${p.id}`)}>
                                <Edit2 className="w-4 h-4" style={{ color: brandColor }} /> Editar Prenda
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 cursor-pointer p-4 rounded-xl text-destructive hover:bg-destructive/5 focus:bg-destructive/5" onClick={() => onDelete(p.id)}>
                                <Trash2 className="w-4 h-4" /> Dar de Baja
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="movements" className="space-y-10">
          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center justify-center mb-6">
            <span className="text-[10px] font-black uppercase text-primary tracking-widest">Mostrando últimos 100 movimientos (Ahorro de lecturas)</span>
          </div>
          {groupedMovements.map(group => (
            <div key={group.label} className="space-y-4">
              <div className="flex items-center gap-3 px-6 py-2.5 text-white rounded-2xl w-fit shadow-md" style={{ backgroundColor: brandColor }}>
                <Calendar className="w-4 h-4" />
                <span className="text-[11px] font-black uppercase tracking-widest">{group.label}</span>
              </div>
              <div className="border border-primary/5 rounded-[2.5rem] bg-white shadow-xl overflow-hidden">
                <Table>
                  <TableBody>
                    {group.items.map(m => (
                      <TableRow key={m.id} className="hover:bg-primary/[0.01] transition-colors border-b last:border-0 h-18">
                        <TableCell className="px-10 py-4">
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-4">
                                <span className={cn(
                                  "text-[9px] font-black uppercase px-3 py-1 rounded-xl border",
                                  m.type === 'in' || m.type === 'return' ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                                )}>
                                  {m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Salida' : 'Retorno'}
                                </span>
                                <span className="font-black text-[13px] text-foreground uppercase">{m.quantity} UNIDADES</span>
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground uppercase leading-none">
                                {m.reason} · <span className="font-black text-primary">{m.productCode}</span>
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-primary/20 tabular-nums bg-primary/5 px-3 py-1.5 rounded-xl">
                              {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 border-none bg-transparent shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista Detallada</DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center bg-black/95 rounded-[3rem] overflow-hidden shadow-2xl">
            <button 
              onClick={() => setZoomImage(null)}
              className="absolute top-8 right-8 z-50 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
            >
              <X className="w-7 h-7" />
            </button>
            {zoomImage && (
              <img 
                src={getDriveThumb(zoomImage, 2000)} 
                className="max-w-full max-h-full object-contain" 
                alt="Zoom" 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
