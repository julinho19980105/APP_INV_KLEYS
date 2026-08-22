
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
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
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
  Package,
  Eye,
  ChevronRight
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
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [syncing, setSyncing] = React.useState(false)

  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  
  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code", "asc")) : null, [db])
  const movementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc"), limit(100)) : null, [db])
  
  const { data: products = [], loading: productsLoading } = useCollection(productsRef)
  const { data: movements = [] } = useCollection(movementsRef)

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  const handleManualSync = async () => {
    if (!db || syncing) return
    setSyncing(true)
    try {
      await syncCatalogToDrive(products)
      await updateDoc(doc(db, "config", "global"), { lastDriveSync: serverTimestamp() })
      toast({ title: "Nube Actualizada" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setSyncing(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!db) return
    if (!confirm("¿Seguro que desea dar de baja esta prenda?")) return
    try {
      await deleteDoc(doc(db, "products", id))
      toast({ title: "Baja Procesada" })
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
  }

  return (
    <div className="space-y-6 pt-4 pb-24 px-2 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-primary/10 pb-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <Package className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-headline font-black text-foreground uppercase tracking-tight">Inventario Maestro</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">Gestión Industrial de Prendas</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row w-full md:w-auto gap-3">
          <Button 
            onClick={handleManualSync}
            disabled={syncing}
            className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase gap-3 bg-primary text-white hover:opacity-90 shadow-lg border-none"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {syncing ? "Sincronizando..." : "Actualizar Catálogo"}
          </Button>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-4 h-4 w-4 text-primary/40" />
            <Input 
              placeholder="" 
              className="pl-12 h-12 rounded-2xl border-primary/10 font-black text-xs uppercase shadow-sm bg-white focus:ring-primary"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-primary/5 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5 border-none h-14">
                <TableHead className="font-black uppercase text-[10px] text-primary/60 pl-8 w-16 text-center">FOTO</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-primary/60">PRENDA / CÓDIGO</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-primary/60">TARIFARIO (S/)</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-primary/60">CATEGORÍA / COLECCIÓN</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-primary/60 text-center">STOCK</TableHead>
                <TableHead className="w-20 pr-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Cargando...</TableCell></TableRow>
              ) : filteredProducts.map(p => (
                <TableRow key={p.id} className="hover:bg-primary/[0.01] transition-colors border-b last:border-0 h-20 group cursor-pointer" onClick={() => setSelectedProduct(p)}>
                  <TableCell className="pl-8 py-2 w-16">
                    <div className="w-14 h-14 rounded-xl border border-primary/5 overflow-hidden bg-secondary shadow-sm">
                      {p.images?.[0] ? (
                        <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" alt="min" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary/20"><ImageIcon className="w-6 h-6" /></div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col justify-center min-w-[200px]">
                      <span className="font-black text-[13px] text-foreground uppercase leading-tight tracking-tight line-clamp-2 max-w-[250px]">{p.name}</span>
                      <span className="font-black text-[9px] text-primary/40 uppercase tracking-widest mt-1">{p.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col text-[10px] font-black uppercase gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-12">FARDO:</span>
                        <span className="text-foreground">{p.priceFardo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-12">MAYOR:</span>
                        <span className="text-foreground">{p.priceMayor}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-primary w-12">UNID:</span>
                        <span className="text-primary font-black">{p.priceUnidad}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-1.5 items-start">
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-primary/10 bg-primary/5 text-primary tracking-widest">{p.category || 'GENERAL'}</Badge>
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-accent/20 bg-accent/10 text-accent-foreground tracking-widest">{p.collection || 'GENERAL'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className={cn(
                      "inline-flex flex-col items-center justify-center w-12 h-12 rounded-full border shadow-sm transition-transform group-hover:scale-110",
                      p.stock <= 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-primary/5 text-primary border-primary/10"
                    )}>
                      <span className="font-black text-[14px] leading-none">{p.stock}</span>
                      <span className="text-[6px] font-bold uppercase mt-0.5">UND</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8 py-2" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-primary/5"><MoreVertical className="w-5 h-5 text-primary" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-[1.5rem] p-3 shadow-2xl border-primary/10 w-48">
                        <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 cursor-pointer p-4 rounded-xl" onClick={() => setSelectedProduct(p)}>
                          <Eye className="w-4 h-4 text-primary" /> Detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 cursor-pointer p-4 rounded-xl" onClick={() => router.push(`/registry?edit=${p.id}`)}>
                          <Edit2 className="w-4 h-4 text-primary" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 cursor-pointer p-4 rounded-xl text-destructive" onClick={() => onDelete(p.id)}>
                          <Trash2 className="w-4 h-4" /> Eliminar
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

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-4xl p-0 border-none rounded-[3rem] overflow-hidden bg-white shadow-2xl">
          <DialogHeader className="hidden"><DialogTitle>Detalle de Prenda</DialogTitle></DialogHeader>
          {selectedProduct && (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh] md:h-[600px]">
              <div className="w-full md:w-1/2 bg-secondary p-8 flex flex-col items-center justify-center gap-6 relative overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-2 gap-4 w-full">
                  {(selectedProduct.images || []).map((img: string, idx: number) => (
                    <div key={idx} className={cn("rounded-2xl overflow-hidden border-2 border-white shadow-lg aspect-square", idx === 0 && "col-span-2")}>
                      <img src={getDriveThumb(img, 800)} className="w-full h-full object-cover" alt="foto" />
                    </div>
                  ))}
                  {(selectedProduct.images || []).length === 0 && (
                    <div className="w-full h-64 flex items-center justify-center text-primary/20"><ImageIcon className="w-20 h-20" /></div>
                  )}
                </div>
              </div>
              <div className="w-full md:w-1/2 p-10 flex flex-col justify-between overflow-y-auto scrollbar-hide">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <Badge className="bg-primary text-white font-black text-[10px] tracking-[0.2em] px-4 py-1.5 rounded-full">{selectedProduct.code}</Badge>
                    <h2 className="text-4xl font-headline font-black text-foreground uppercase leading-none tracking-tighter">{selectedProduct.name}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-6 bg-primary/5 p-6 rounded-[2rem] border border-primary/10">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Stock Disponible</p>
                      <p className="text-3xl font-headline font-black text-primary">{selectedProduct.stock} UND</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Precio Unidad</p>
                      <p className="text-3xl font-headline font-black text-foreground">S/ {selectedProduct.priceUnidad}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <LayoutGrid className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-black uppercase text-foreground tracking-widest">Clasificación</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">{selectedProduct.category}</Badge>
                      <Badge variant="secondary" className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">{selectedProduct.collection}</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-black uppercase text-foreground tracking-widest">Descripción Estética</span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">
                      "{selectedProduct.description || 'Sin descripción detallada disponible.'}"
                    </p>
                  </div>
                </div>

                <div className="pt-8 flex gap-3">
                  <Button className="flex-1 h-16 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20" onClick={() => { setSelectedProduct(null); router.push(`/registry?edit=${selectedProduct.id}`); }}>
                    <Edit2 className="w-5 h-5 mr-3" /> EDITAR PRENDA
                  </Button>
                  <Button variant="outline" className="h-16 w-16 rounded-2xl border-primary/10 text-primary" onClick={() => setSelectedProduct(null)}>
                    <X className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
