
"use client"

import * as React from "react"
import { 
  Plus, 
  Package, 
  Trash2, 
  MoreVertical, 
  ImageIcon, 
  X,
  Loader2,
  PackagePlus,
  ChevronRight,
  Filter,
  Upload,
  Eye
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, serverTimestamp, updateDoc, increment, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { syncCatalogToDrive } from "@/services/sheets-service"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Dialog,
  DialogContent
} from "@/components/ui/dialog"

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
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("NIÑAS")
  const [expandedCollections, setExpandedCollections] = React.useState<Record<string, boolean>>({})
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [addStockProduct, setAddStockProduct] = React.useState<any>(null)
  const [addStockQty, setAddStockQty] = React.useState("")
  const [isExporting, setIsExporting] = React.useState(false)

  const productsRef = React.useMemo(() => 
    db ? query(collection(db, "products"), orderBy("updatedAt", "desc")) : null
  , [db])
  const { data: products = [], loading: productsLoading } = useCollection(productsRef)

  const categoriesRef = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const { data: dbCategories = [] } = useCollection(categoriesRef)
  const masterCategories = React.useMemo(() => dbCategories.map(c => c.name.toUpperCase()).sort(), [dbCategories])

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => {
      const matchesSearch = p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || p.code?.toLowerCase().includes(q)
      const matchesCat = categoryFilter === "all" || (p.category || "").toUpperCase() === categoryFilter.toUpperCase()
      return matchesSearch && matchesCat
    })
  }, [products, searchQuery, categoryFilter])

  const groupedByCollection = React.useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredProducts.forEach(p => {
      const col = (p.collection || "SIN COLECCIÓN").toUpperCase()
      if (!groups[col]) groups[col] = []
      groups[col].push(p)
    })
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredProducts])

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
    updateDoc(productRef, { stock: increment(qty), updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: productRef.path, operation: 'update' }));
    });
    toast({ title: "STOCK ACTUALIZADO" })
    setAddStockProduct(null)
    setAddStockQty("")
  }

  const onDelete = (id: string) => {
    if (!db) return
    if (confirm("¿ELIMINAR PRENDA?")) {
      deleteDoc(doc(db, "products", id)).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `products/${id}`, operation: 'delete' }));
      });
      toast({ title: "ELIMINADO" })
    }
  }

  const toggleCollection = (col: string) => {
    setExpandedCollections(prev => ({ ...prev, [col]: !prev[col] }))
  }

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER CONTROL */}
      <div className="flex flex-col gap-4 sticky top-0 z-40 bg-background/95 backdrop-blur-md pb-4 pt-2 border-b-2 border-primary/10">
        <div className="flex items-center justify-between gap-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 w-full md:w-64 rounded-xl border-primary/20 font-black text-[12px] uppercase bg-white shadow-sm">
              <SelectValue placeholder="CATEGORÍA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-black uppercase text-[10px]">TODAS</SelectItem>
              {masterCategories.map(cat => <SelectItem key={cat} value={cat} className="font-black uppercase text-[10px]">{cat}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => syncCatalogToDrive(products)} disabled={isExporting} className="h-11 px-4 rounded-xl border-primary/20 text-primary font-black text-[10px] uppercase gap-2 bg-white">
            {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} EXPORT
          </Button>
        </div>
        <div className="relative">
          <Input 
            placeholder="BUSCAR MODELO O CÓDIGO..." 
            className="pl-4 h-12 rounded-xl border-primary/20 font-black text-[11px] uppercase shadow-inner bg-primary/5"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* STOCK UPDATE POPUP */}
      {addStockProduct && (
        <div className="fixed inset-x-4 top-24 z-50 bg-white border-2 border-green-500 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4">
          <div className="flex-1">
            <p className="text-[9px] font-black text-green-600 uppercase">{addStockProduct.code}</p>
            <p className="text-[11px] font-black uppercase truncate">{addStockProduct.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" value={addStockQty} onChange={e => setAddStockQty(e.target.value)} className="w-16 h-10 text-center font-black rounded-lg border-green-200" placeholder="0" />
            <Button className="h-10 bg-green-600 text-white font-black text-[10px] uppercase rounded-lg px-4" onClick={handleInMovement}>+ OK</Button>
            <Button variant="ghost" className="h-10 w-10 p-0 text-muted-foreground" onClick={() => setAddStockProduct(null)}><X className="w-5 h-5" /></Button>
          </div>
        </div>
      )}

      {/* GALLERY BY COLLECTIONS */}
      <div className="space-y-8">
        {productsLoading ? (
          <div className="py-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        ) : groupedByCollection.map(([colName, colProducts]) => {
          const isExpanded = expandedCollections[colName]
          const visibleProducts = isExpanded ? colProducts : colProducts.slice(0, 4)
          
          return (
            <div key={colName} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="font-headline font-black text-lg uppercase tracking-tight text-foreground">{colName}</span>
                  <Badge variant="outline" className="text-[9px] font-black border-primary/20 text-primary">{colProducts.length} PRODUCTOS</Badge>
                </div>
                {colProducts.length > 4 && (
                  <Button 
                    variant="ghost" 
                    className="h-8 font-black text-[10px] uppercase text-primary hover:bg-primary/5"
                    onClick={() => toggleCollection(colName)}
                  >
                    {isExpanded ? "CONTRAER" : "VER TODO"} <ChevronRight className={cn("w-3 h-3 ml-1 transition-transform", isExpanded && "rotate-90")} />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 px-1">
                {visibleProducts.map(p => (
                  <div key={p.id} className="group relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-primary/5 bg-secondary shadow-sm hover:shadow-xl transition-all">
                    {/* FOTO */}
                    <img 
                      src={getDriveThumb(p.images?.[0], 600)} 
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setSelectedProduct(p)}
                      alt={p.name}
                    />
                    
                    {/* CÓDIGO (TOP LEFT) */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black text-white text-[9px] font-black rounded-md shadow-lg">
                      {p.code}
                    </div>

                    {/* STOCK (BOTTOM RIGHT) */}
                    <div className={cn(
                      "absolute bottom-2 right-2 px-2 py-1 text-[10px] font-black rounded-md shadow-lg",
                      p.stock <= 0 ? "bg-red-600 text-white" : "bg-primary text-white"
                    )}>
                      {p.stock} UND
                    </div>

                    {/* BOTONES ACCIÓN (BOTTOM LEFT) */}
                    <div className="absolute bottom-2 left-2 flex gap-1 items-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" className="h-7 w-7 bg-white/90 text-primary hover:bg-white rounded-lg shadow-md" onClick={() => setAddStockProduct(p)}>
                        <PackagePlus className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" className="h-7 w-7 bg-white/90 text-primary hover:bg-white rounded-lg shadow-md" onClick={() => setSelectedProduct(p)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" className="h-7 w-7 bg-white/90 text-destructive hover:bg-white rounded-lg shadow-md" onClick={() => onDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* OVERLAY NOMBRE */}
                    <div className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-black/40 to-transparent p-2">
                      <p className="text-[9px] font-black text-white uppercase truncate drop-shadow-md">{p.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* DETAIL DIALOG */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-md p-0 border-none rounded-[2rem] bg-white overflow-hidden shadow-2xl">
          {selectedProduct && (
            <div className="flex flex-col pb-8">
              <div className="w-full aspect-square bg-secondary relative">
                <img src={getDriveThumb(selectedProduct.images?.[0], 800)} className="w-full h-full object-cover" />
                <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 p-3 bg-black/20 text-white rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex flex-col gap-1">
                  <Badge className="bg-primary text-white text-[10px] font-black w-fit">{selectedProduct.code}</Badge>
                  <h2 className="text-2xl font-headline font-black text-black uppercase">{selectedProduct.name}</h2>
                  <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{selectedProduct.category} | {selectedProduct.collection}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <div className="text-center"><p className="text-[8px] font-black text-primary/50 uppercase">STOCK</p><p className="text-lg font-black">{selectedProduct.stock}</p></div>
                  <div className="text-center border-x border-primary/10"><p className="text-[8px] font-black text-primary/50 uppercase">MAYOR</p><p className="text-lg font-black">S/ {selectedProduct.priceMayor}</p></div>
                  <div className="text-center"><p className="text-[8px] font-black text-primary/50 uppercase">UNID</p><p className="text-lg font-black">S/ {selectedProduct.priceUnidad}</p></div>
                </div>
                <div className="p-4 bg-secondary/50 rounded-2xl border border-black/5 text-[11px] font-medium text-muted-foreground italic leading-relaxed">
                  "{selectedProduct.description || 'Sin descripción.'}"
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Button className="h-12 bg-primary text-white font-black uppercase text-[10px] rounded-xl" onClick={() => setAddStockProduct(selectedProduct)}>Añadir Stock</Button>
                  <Button variant="outline" className="h-12 border-primary/20 text-primary font-black uppercase text-[10px] rounded-xl" onClick={() => setSelectedProduct(null)}>Cerrar</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
