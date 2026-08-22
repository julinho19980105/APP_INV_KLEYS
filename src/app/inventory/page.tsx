
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Edit2, 
  Trash2, 
  MoreVertical, 
  ImageIcon, 
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Eye,
  LayoutGrid,
  History
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore"
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
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [collectionFilter, setCollectionFilter] = React.useState("all")
  const [isRecentSort, setIsRecentSort] = React.useState(true)
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [syncing, setSyncing] = React.useState(false)

  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  
  const productsRef = React.useMemo(() => 
    db ? query(collection(db, "products"), orderBy(isRecentSort ? "updatedAt" : "code", isRecentSort ? "desc" : "asc")) : null
  , [db, isRecentSort])
  
  const { data: products = [], loading: productsLoading } = useCollection(productsRef)

  const uniqueCategories = React.useMemo(() => 
    Array.from(new Set(products.map(p => (p.category || "").toUpperCase()))).filter(Boolean).sort()
  , [products])

  const uniqueCollections = React.useMemo(() => 
    Array.from(new Set(products.map(p => (p.collection || "").toUpperCase()))).filter(Boolean).sort()
  , [products])

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => {
      const matchesSearch = p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || p.code?.toLowerCase().includes(q)
      const matchesCat = categoryFilter === "all" || (p.category || "").toUpperCase() === categoryFilter
      const matchesCol = collectionFilter === "all" || (p.collection || "").toUpperCase() === collectionFilter
      return matchesSearch && matchesCat && matchesCol
    })
  }, [products, searchQuery, categoryFilter, collectionFilter])

  const handleManualSync = async () => {
    if (!db || syncing) return
    setSyncing(true)
    try {
      await syncCatalogToDrive(products)
      await updateDoc(doc(db, "config", "global"), { lastDriveSync: serverTimestamp() })
      toast({ title: "Catálogo Sincronizado" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setSyncing(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!db) return
    if (!confirm("¿Desea eliminar esta prenda?")) return
    try {
      await deleteDoc(doc(db, "products", id))
      toast({ title: "Producto Eliminado" })
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
  }

  return (
    <div className="space-y-4 pt-2 pb-24 px-2 md:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-primary/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-black text-foreground uppercase tracking-tight">Inventario</h1>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Gestión Maestro</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:flex md:flex-row w-full md:w-auto gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 rounded-lg border-primary/10 font-black text-[9px] uppercase bg-white w-full md:w-32">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[9px] font-black uppercase">Categorías</SelectItem>
              {uniqueCategories.map(cat => <SelectItem key={cat} value={cat} className="text-[9px] font-black uppercase">{cat}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="h-9 rounded-lg border-primary/10 font-black text-[9px] uppercase bg-white w-full md:w-32">
              <SelectValue placeholder="Colección" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[9px] font-black uppercase">Colecciones</SelectItem>
              {uniqueCollections.map(col => <SelectItem key={col} value={col} className="text-[9px] font-black uppercase">{col}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button 
            variant={isRecentSort ? "default" : "outline"}
            className="h-9 px-4 rounded-lg font-black text-[9px] uppercase gap-2 w-full md:w-auto"
            onClick={() => setIsRecentSort(!isRecentSort)}
          >
            <History className="w-3.5 h-3.5" />
            {isRecentSort ? "Recientes" : "Código"}
          </Button>

          <div className="relative w-full md:w-60 col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary/40" />
            <Input 
              placeholder="" 
              className="pl-10 h-9 rounded-lg border-primary/10 font-black text-xs uppercase shadow-sm bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-primary/5 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5 border-none h-12">
                <TableHead className="font-black uppercase text-[9px] text-primary/60 pl-6 w-14 text-center">FOTO</TableHead>
                <TableHead className="font-black uppercase text-[9px] text-primary/60">PRENDA</TableHead>
                <TableHead className="font-black uppercase text-[9px] text-primary/60">PRECIOS (S/)</TableHead>
                <TableHead className="font-black uppercase text-[9px] text-primary/60">ETIQUETAS</TableHead>
                <TableHead className="font-black uppercase text-[9px] text-primary/60 text-center">STOCK</TableHead>
                <TableHead className="w-14 pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Cargando...</TableCell></TableRow>
              ) : filteredProducts.map(p => (
                <TableRow key={p.id} className="hover:bg-primary/[0.01] transition-colors border-b last:border-0 h-16 group cursor-pointer" onClick={() => setSelectedProduct(p)}>
                  <TableCell className="pl-6 py-2 w-14">
                    <div className="w-10 h-10 rounded-lg border border-primary/5 overflow-hidden bg-secondary shadow-sm">
                      {p.images?.[0] ? (
                        <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" alt="min" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary/20"><ImageIcon className="w-5 h-5" /></div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 max-w-[200px]">
                    <div className="flex flex-col justify-center">
                      <span className="font-black text-[12px] text-foreground uppercase leading-tight tracking-tight line-clamp-2">{p.name}</span>
                      <span className="font-black text-[8px] text-primary/40 uppercase tracking-widest mt-0.5">{p.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex gap-4 text-[9px] font-black uppercase">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-[7px]">FARDO</span>
                        <span>{p.priceFardo}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-[7px]">MAYOR</span>
                        <span>{p.priceMayor}</span>
                      </div>
                      <div className="flex flex-col text-primary">
                        <span className="text-[7px]">UNIDAD</span>
                        <span>{p.priceUnidad}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex gap-1 items-start flex-wrap">
                      <Badge variant="outline" className="text-[7px] font-black uppercase px-2 py-0 border-primary/10 bg-primary/5 text-primary">{p.category || 'GEN'}</Badge>
                      <Badge variant="outline" className="text-[7px] font-black uppercase px-2 py-0 border-accent/20 bg-accent/10 text-accent-foreground">{p.collection || 'GEN'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className={cn(
                      "inline-flex flex-col items-center justify-center w-9 h-9 rounded-full border shadow-sm transition-transform group-hover:scale-110",
                      p.stock <= 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-primary/5 text-primary border-primary/10"
                    )}>
                      <span className="font-black text-[12px] leading-none">{p.stock}</span>
                      <span className="text-[5px] font-bold uppercase">UND</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6 py-2" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical className="w-4 h-4 text-primary" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl p-2 w-40 shadow-xl">
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 cursor-pointer p-3 rounded-lg" onClick={() => setSelectedProduct(p)}>
                          <Eye className="w-3.5 h-3.5 text-primary" /> Detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 cursor-pointer p-3 rounded-lg" onClick={() => router.push(`/registry?edit=${p.id}`)}>
                          <Edit2 className="w-3.5 h-3.5 text-primary" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 cursor-pointer p-3 rounded-lg text-destructive" onClick={() => onDelete(p.id)}>
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
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
        <DialogContent className="max-w-4xl p-0 border-none rounded-[2rem] overflow-hidden bg-white shadow-2xl">
          <DialogHeader className="hidden"><DialogTitle>Detalle</DialogTitle></DialogHeader>
          {selectedProduct && (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh] md:h-[500px]">
              <div className="w-full md:w-1/2 bg-secondary p-6 flex flex-col items-center justify-center gap-4 relative overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-2 gap-3 w-full">
                  {(selectedProduct.images || []).map((img: string, idx: number) => (
                    <div key={idx} className={cn("rounded-xl overflow-hidden border-2 border-white shadow-md aspect-square", idx === 0 && "col-span-2")}>
                      <img src={getDriveThumb(img, 800)} className="w-full h-full object-cover" alt="foto" />
                    </div>
                  ))}
                  {(selectedProduct.images || []).length === 0 && (
                    <div className="w-full h-48 flex items-center justify-center text-primary/20"><ImageIcon className="w-16 h-16" /></div>
                  )}
                </div>
              </div>
              <div className="w-full md:w-1/2 p-8 flex flex-col justify-between overflow-y-auto scrollbar-hide">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <Badge className="bg-primary text-white font-black text-[8px] tracking-[0.2em] px-3 py-1 rounded-lg">{selectedProduct.code}</Badge>
                    <h2 className="text-3xl font-headline font-black text-foreground uppercase leading-tight">{selectedProduct.name}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <div>
                      <p className="text-[8px] font-black text-primary/40 uppercase tracking-widest">Disponible</p>
                      <p className="text-xl font-headline font-black text-primary">{selectedProduct.stock} UND</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-primary/40 uppercase tracking-widest">P. Unidad</p>
                      <p className="text-xl font-headline font-black text-foreground">S/ {selectedProduct.priceUnidad}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[9px] font-black uppercase text-foreground tracking-widest">Información Estética</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground italic">
                      "{selectedProduct.description || 'Sin descripción disponible.'}"
                    </p>
                  </div>
                </div>

                <div className="pt-6 flex gap-2">
                  <Button className="flex-1 h-12 rounded-xl bg-primary text-white font-black text-xs uppercase" onClick={() => { setSelectedProduct(null); router.push(`/registry?edit=${selectedProduct.id}`); }}>
                    <Edit2 className="w-4 h-4 mr-2" /> Editar Ficha
                  </Button>
                  <Button variant="outline" className="h-12 w-12 rounded-xl border-primary/10 text-primary" onClick={() => setSelectedProduct(null)}>
                    <X className="w-5 h-5" />
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
