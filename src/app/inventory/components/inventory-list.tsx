
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
import { Label } from "@/components/ui/label"
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
  Loader2,
  Package,
  Plus,
  PackagePlus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Upload
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, serverTimestamp, updateDoc, increment, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
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

export default function InventoryList() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [collectionFilter, setCollectionFilter] = React.useState("all")
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [currentImgIdx, setCurrentImgIdx] = React.useState(0)
  const [addStockProduct, setAddStockProduct] = React.useState<any>(null)
  const [addStockQty, setAddStockQty] = React.useState("")
  const [isExporting, setIsExporting] = React.useState(false)

  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#0296FF"
  
  const productsRef = React.useMemo(() => 
    db ? query(collection(db, "products"), orderBy("updatedAt", "desc")) : null
  , [db])
  const { data: products = [], loading: productsLoading } = useCollection(productsRef)

  const categoriesRef = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsRef = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const { data: dbCategories = [] } = useCollection(categoriesRef)
  const { data: dbCollections = [] } = useCollection(collectionsRef)

  const masterCategories = React.useMemo(() => dbCategories.map(c => c.name.toUpperCase()).sort(), [dbCategories])
  const masterCollections = React.useMemo(() => dbCollections.map(c => c.name.toUpperCase()).sort(), [dbCollections])

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => {
      const matchesSearch = p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || p.code?.toLowerCase().includes(q)
      const matchesCat = categoryFilter === "all" || (p.category || "").toUpperCase() === categoryFilter
      const matchesCol = collectionFilter === "all" || (p.collection || "").toUpperCase() === collectionFilter
      return matchesSearch && matchesCat && matchesCol
    })
  }, [products, searchQuery, categoryFilter, collectionFilter])

  const handleExport = React.useCallback(async (isAuto = false) => {
    if (!products || products.length === 0 || isExporting) return
    setIsExporting(true)
    try {
      const activeProducts = products.filter(p => p.stock > 0)
      await syncCatalogToDrive(activeProducts)
      if (!isAuto) toast({ title: "SINCRONIZADO CON DRIVE" })
    } catch (e) {
      if (!isAuto) toast({ variant: "destructive", title: "ERROR DE EXPORTACIÓN" })
    } finally {
      setIsExporting(false)
    }
  }, [products, isExporting, toast])

  const handleInMovement = () => {
    if (!db || !addStockProduct || !addStockQty) return
    const qty = Number(addStockQty)
    if (isNaN(qty) || qty <= 0) return

    const productRef = doc(db, "products", addStockProduct.code)

    addDoc(collection(db, "movements"), {
      productCode: addStockProduct.code,
      type: "in",
      quantity: qty,
      reason: "REPOSICIÓN DE STOCK",
      timestamp: serverTimestamp()
    }).catch(() => {});
    
    updateDoc(productRef, {
      stock: increment(qty),
      updatedAt: serverTimestamp()
    }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: productRef.path, operation: 'update' }));
    });

    toast({ title: "Stock actualizado" })
    setAddStockProduct(null)
    setAddStockQty("")
  }

  const onDelete = (id: string) => {
    if (!db) return
    if (confirm("¿ELIMINAR PRENDA?")) {
      deleteDoc(doc(db, "products", id)).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `products/${id}`, operation: 'delete' }));
      });
      toast({ title: "Producto eliminado" })
    }
  }

  return (
    <div className="space-y-4">
      {addStockProduct && (
        <div className="bg-white border-2 border-green-500/20 rounded-2xl p-4 shadow-xl animate-in slide-in-from-top-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 flex items-center gap-3">
              <PackagePlus className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="text-[10px] font-black uppercase">{addStockProduct.name}</h3>
                <p className="text-[8px] font-black text-green-600 uppercase tracking-widest">{addStockProduct.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input 
                type="number" 
                value={addStockQty} 
                onChange={e => setAddStockQty(e.target.value)}
                placeholder="0"
                className="h-10 w-24 font-black text-center border-green-200 rounded-xl"
              />
              <button className="h-10 bg-green-600 text-white font-black text-[9px] uppercase rounded-xl flex-1 md:flex-none px-4" onClick={handleInMovement}>Confirmar</button>
              <button onClick={() => setAddStockProduct(null)} className="p-2 text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-b border-primary/10 pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-headline font-black text-foreground uppercase tracking-tight">Inventario Maestro</h1>
          <div className="flex gap-1">
             <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-8 p-0 rounded-xl border-primary/10 shadow-sm bg-white hover:bg-primary/5 flex items-center justify-center">
                  <Filter className="w-3.5 h-3.5 text-primary" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[9px] font-black uppercase">Todas</SelectItem>
                  {masterCategories.map(cat => <SelectItem key={cat} value={cat} className="text-[9px] font-black uppercase">{cat}</SelectItem>)}
                </SelectContent>
              </Select>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-primary/40" />
            <Input 
              placeholder="BUSCAR PRENDA..." 
              className="pl-9 h-10 rounded-xl border-primary/10 font-black text-[10px] uppercase shadow-sm bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => handleExport()} disabled={isExporting} className="h-10 px-4 rounded-xl border-primary/20 text-primary font-black text-[10px] uppercase gap-2 bg-white">
            {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} EXPORT
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5 hover:bg-primary/5 border-none h-10">
              <TableHead className="font-black uppercase text-[8px] text-primary/60 w-12 text-center">FOTO</TableHead>
              <TableHead className="font-black uppercase text-[8px] text-primary/60">PRENDA</TableHead>
              <TableHead className="font-black uppercase text-[8px] text-primary/60 text-center">STOCK</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsLoading ? (
              <TableRow><TableCell colSpan={4} className="h-20 text-center opacity-40 text-[9px] font-black uppercase">Cargando...</TableCell></TableRow>
            ) : filteredProducts.map(p => (
              <TableRow key={p.id} className="hover:bg-primary/[0.01] border-b last:border-0 h-16">
                <TableCell className="pl-4 py-2 w-12 text-center">
                  <div className="w-10 h-10 rounded-lg border overflow-hidden bg-secondary shadow-sm cursor-pointer" onClick={() => setSelectedProduct(p)}>
                    {p.images?.[0] ? <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 opacity-10" />}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-col">
                    <span className="font-black text-[10px] uppercase leading-tight line-clamp-1">{p.name}</span>
                    <span className="font-black text-[7px] text-primary/40 uppercase tracking-widest">{p.code}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className={cn("inline-flex flex-col items-center justify-center w-8 h-8 rounded-full border shadow-sm", p.stock <= 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200")}>
                    <span className="font-black text-[10px] leading-none">{p.stock}</span>
                    <span className="text-[5px] font-bold">UND</span>
                  </div>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><button className="h-7 w-7 flex items-center justify-center hover:bg-primary/5 rounded-lg"><MoreVertical className="w-3 h-3 text-primary" /></button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl p-1 shadow-xl w-40">
                      <DropdownMenuItem className="text-[9px] font-black uppercase gap-2.5 p-2.5 text-green-600" onClick={() => setAddStockProduct(p)}><Plus className="w-3 h-3" /> Añadir Stock</DropdownMenuItem>
                      <DropdownMenuItem className="text-[9px] font-black uppercase gap-2.5 p-2.5" onClick={() => setSelectedProduct(p)}><Package className="w-3.5 h-3.5" /> Ver Detalle</DropdownMenuItem>
                      <DropdownMenuItem className="text-[9px] font-black uppercase gap-2.5 p-2.5 text-destructive" onClick={() => onDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-md p-0 border-none rounded-[2rem] bg-white shadow-2xl overflow-hidden">
          {selectedProduct && (
            <div className="flex flex-col pb-8">
              <div className="w-full aspect-square bg-secondary relative">
                {selectedProduct.images?.[0] ? <img src={getDriveThumb(selectedProduct.images[0], 800)} className="w-full h-full object-cover" /> : <ImageIcon className="w-12 h-12 opacity-10" />}
              </div>
              <div className="p-6 space-y-4">
                <div className="flex flex-col gap-1">
                  <Badge className="bg-primary text-white text-[8px] font-black px-2 w-fit">{selectedProduct.code}</Badge>
                  <h2 className="text-xl font-headline font-black text-foreground uppercase">{selectedProduct.name}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <div className="flex flex-col"><p className="text-[7px] font-black text-primary/50 uppercase">STOCK</p><p className="text-lg font-black">{selectedProduct.stock} UND</p></div>
                  <div className="flex flex-col"><p className="text-[7px] font-black text-primary/50 uppercase">PRECIO UNID</p><p className="text-lg font-black">S/ {selectedProduct.priceUnidad}</p></div>
                </div>
                <div className="p-4 bg-secondary/50 rounded-xl border border-black/5 text-[10px] font-medium text-muted-foreground italic">
                  "{selectedProduct.description || 'Sin descripción registrada.'}"
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
