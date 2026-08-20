
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
  CloudSync,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { syncCatalogToDrive } from "@/services/sheets-service"

// Helper to transform Drive URLs to thumbnails
function getDriveThumb(url: string, size: number = 400) {
  if (!url || !url.includes('drive.google.com')) return url;
  
  let fileId = '';
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) {
    fileId = idMatch[1];
  } else {
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch && dMatch[1]) {
      fileId = dMatch[1];
    }
  }

  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
  }
  return url;
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
  const movementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc")) : null, [db])
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
      toast({ title: "Sincronizando...", description: "Actualizando Google Sheet y JSON..." })
      await syncCatalogToDrive(products)
      await updateDoc(doc(db, "config", "global"), {
        lastDriveSync: serverTimestamp()
      })
      toast({ title: "Nube Actualizada", description: "El Sheet y JSON están al día." })
    } catch (e: any) {
      console.error(e)
      toast({ 
        variant: "destructive", 
        title: "Error de Sincronización", 
        description: e.message || "No se pudo actualizar Drive." 
      })
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
    <div className="space-y-6 pt-2 pb-20 max-w-full px-2 md:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-black pb-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Stock Maestro</h1>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] ml-1 mt-0.5">
              Vista por {viewType === 'collection' ? 'Colección' : 'Categoría'} · Diva Industrial
            </p>
          </div>
          <Button 
            onClick={handleManualSync}
            disabled={syncing}
            variant="outline"
            className={cn(
              "h-12 px-4 rounded-xl font-black text-[9px] uppercase gap-2 transition-all border-2",
              needsSync 
                ? "border-red-500 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-600 shadow-md animate-pulse" 
                : "border-green-500 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-600"
            )}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : needsSync ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {syncing ? "Sincronizando..." : needsSync ? "Sincronizar Nube" : "Forzar Sincronización"}
          </Button>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3.5 h-4 w-4" style={{ color: brandColor }} />
          <Input 
            placeholder="BUSCAR PRENDA..." 
            className="pl-10 h-11 rounded-xl border-black/10 font-black text-xs uppercase shadow-sm bg-white"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full md:w-auto justify-start border mb-4">
          <TabsTrigger value="all" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest">Almacén</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest">Kardex</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-10">
          {groupedProducts.map(([groupName, items]) => (
            <div key={groupName} className="space-y-4">
              <div className="flex items-center gap-3 px-6 py-2 bg-black text-white rounded-2xl w-fit shadow-lg">
                {viewType === 'collection' ? <LayoutGrid className="w-4 h-4" style={{ color: brandColor }} /> : <Layers className="w-4 h-4" style={{ color: brandColor }} />}
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">{groupName}</span>
              </div>
              
              <div className="border-2 border-black/5 rounded-[2rem] bg-white shadow-xl overflow-x-auto scrollbar-hide">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-black/5 hover:bg-black/5 border-none h-12">
                      <TableHead className="font-black uppercase text-[10px] text-black pl-8">Prenda / DNI</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-black">Precios (F / M / U)</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-black text-center">Stock</TableHead>
                      <TableHead className="w-16 pr-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(p => (
                      <TableRow key={p.id} className="hover:bg-black/[0.02] transition-colors border-b last:border-0 h-16">
                        <TableCell className="pl-8 py-3">
                          <div className="flex items-center gap-4">
                            <div className="flex gap-1 shrink-0">
                              {(p.images || []).length > 0 ? (p.images || []).slice(0, 3).map((img: string, idx: number) => (
                                <div 
                                  key={idx} 
                                  className="w-10 h-10 rounded-lg border overflow-hidden bg-black/5 cursor-pointer hover:ring-2 transition-all"
                                  onClick={() => setZoomImage(img)}
                                  style={{ borderColor: brandColor }}
                                >
                                  <img src={getDriveThumb(img, 400)} className="w-full h-full object-cover" alt="foto" />
                                </div>
                              )) : (
                                <ImageIcon className="w-6 h-6 opacity-20" style={{ color: brandColor }} />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-[13px] text-black uppercase leading-none">{p.name}</span>
                              <span className="font-black text-[9px] text-black/40 uppercase tracking-widest mt-1">{p.code}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-col text-[10px] uppercase">
                            <span className="font-normal text-black/60">F: {p.priceFardo} · M: {p.priceMayor}</span>
                            <span className="font-black text-black">UNIT: S/ {p.priceUnidad}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <div className={cn(
                            "font-black text-[11px] px-4 py-1.5 rounded-xl inline-flex flex-col items-center justify-center min-w-[70px] shadow-sm",
                            p.stock <= 0 ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"
                          )}>
                            <span>{p.stock}</span>
                            <span className="text-[7px] font-normal uppercase opacity-60">UND</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-black/5 transition-all"><MoreVertical className="w-5 h-5 text-black" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-black/10 w-44">
                              <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 cursor-pointer p-4 rounded-xl" onClick={() => router.push(`/registry?edit=${p.id}`)}>
                                <Edit2 className="w-4 h-4" style={{ color: brandColor }} /> Editar Prenda
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 cursor-pointer p-4 rounded-xl text-destructive" onClick={() => onDelete(p.id)}>
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

        <TabsContent value="movements" className="space-y-8">
          {groupedMovements.map(group => (
            <div key={group.label} className="space-y-4">
              <div className="flex items-center gap-3 px-6 py-2 bg-black text-white rounded-2xl w-fit shadow-lg">
                <Calendar className="w-4 h-4" style={{ color: brandColor }} />
                <span className="text-[10px] font-black uppercase tracking-widest">{group.label}</span>
              </div>
              <div className="border-2 border-black/5 rounded-[2rem] bg-white shadow-xl overflow-hidden">
                <Table>
                  <TableBody>
                    {group.items.map(m => (
                      <TableRow key={m.id} className="hover:bg-black/[0.01] transition-colors border-b last:border-0 h-16">
                        <TableCell className="px-8 py-3">
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  "text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border",
                                  m.type === 'in' || m.type === 'return' ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                                )}>
                                  {m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Salida' : 'Retorno'}
                                </span>
                                <span className="font-black text-[12px] text-black uppercase">{m.quantity} UNIDADES</span>
                              </div>
                              <span className="text-[10px] font-normal text-black/50 uppercase leading-none">
                                {m.reason} · <span className="font-black text-black/70">{m.productCode}</span>
                              </span>
                            </div>
                            <span className="text-[9px] font-black text-black/20 tabular-nums bg-black/5 px-2 py-1 rounded-lg">
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
            <DialogTitle>Vista de imagen de producto</DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center bg-black/90 rounded-[2rem] overflow-hidden">
            <button 
              onClick={() => setZoomImage(null)}
              className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
            >
              <X className="w-6 h-6" />
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
