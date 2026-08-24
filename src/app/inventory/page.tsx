
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, serverTimestamp, updateDoc, increment, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

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
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [currentImgIdx, setCurrentImgIdx] = React.useState(0)
  const [addStockProduct, setAddStockProduct] = React.useState<any>(null)
  const [addStockQty, setAddStockQty] = React.useState("")

  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  
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
    if (confirm("¿Desea eliminar esta prenda?")) {
      deleteDoc(doc(db, "products", id)).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `products/${id}`, operation: 'delete' }));
      });
      toast({ title: "Producto eliminado" })
    }
  }

  const openDetail = (product: any) => {
    setSelectedProduct(product)
    setCurrentImgIdx(0)
  }

  return (
    <div className="space-y-4 pt-2 pb-32 px-2 md:px-4">
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
              <Button className="h-10 bg-green-600 text-white font-black text-[9px] uppercase rounded-xl flex-1 md:flex-none" onClick={handleInMovement} disabled={!addStockQty}><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar</Button>
              <Button variant="ghost" size="icon" onClick={() => { setAddStockProduct(null); setAddStockQty(""); }}><X className="w-5 h-5" /></Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b border-primary/10 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ backgroundColor: brandColor }}><Package className="w-4 h-4 text-white" /></div>
          <div>
            <h1 className="text-xl font-headline font-black text-foreground uppercase tracking-tight">Inventario</h1>
            <p className="text-[8px] font-black text-primary uppercase tracking-widest">Lista Maestra</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:flex md:flex-row w-full md:w-auto gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 rounded-lg border-primary/10 font-black text-[8px] uppercase bg-white w-full md:w-32">
              <SelectValue placeholder="Categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todas</SelectItem>
              {masterCategories.map(cat => <SelectItem key={cat} value={cat} className="text-[9px] font-black uppercase">{cat}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="h-9 rounded-lg border-primary/10 font-black text-[8px] uppercase bg-white w-full md:w-32">
              <SelectValue placeholder="Colecciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todas</SelectItem>
              {masterCollections.map(col => <SelectItem key={col} value={col} className="text-[9px] font-black uppercase">{col}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative w-full md:w-60 col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary/40" />
            <Input 
              placeholder="" 
              className="pl-9 h-9 rounded-lg border-primary/10 font-black text-[10px] uppercase shadow-sm bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5 border-none h-10">
                <TableHead className="font-black uppercase text-[8px] text-primary/60 w-12 text-center">FOTO</TableHead>
                <TableHead className="font-black uppercase text-[8px] text-primary/60">PRENDA</TableHead>
                <TableHead className="font-black uppercase text-[8px] text-primary/60">PRECIOS (S/)</TableHead>
                <TableHead className="font-black uppercase text-[8px] text-primary/60">ETIQUETAS</TableHead>
                <TableHead className="font-black uppercase text-[8px] text-primary/60 text-center">STOCK</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow><TableCell colSpan={6} className="h-20 text-center opacity-40 text-[9px] font-black uppercase">Cargando...</TableCell></TableRow>
              ) : filteredProducts.map(p => (
                <TableRow key={p.id} className="hover:bg-primary/[0.01] border-b last:border-0 h-16">
                  <TableCell className="pl-4 py-2 w-12">
                    <div 
                      className="w-10 h-10 rounded-lg border overflow-hidden bg-secondary shadow-sm cursor-pointer active:scale-95 transition-transform"
                      onClick={() => openDetail(p)}
                    >
                      {p.images?.[0] ? <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 opacity-10" />}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col">
                      <span className="font-black text-[10px] uppercase leading-tight line-clamp-1">{p.name}</span>
                      <span className="font-black text-[7px] text-primary/40 uppercase tracking-widest">{p.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col text-[8px] font-black uppercase">
                      <span className="text-muted-foreground"><span className="text-[6px]">MAYOR:</span> S/ {p.priceMayor}</span>
                      <span className="text-primary"><span className="text-[6px]">UNID:</span> S/ {p.priceUnidad}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-0.5 items-start">
                      <Badge variant="outline" className="text-[6px] font-black px-1.5 py-0 border-primary/10 bg-primary/5 text-primary">{p.category || '-'}</Badge>
                      <Badge variant="outline" className="text-[6px] font-black px-1.5 py-0 border-accent/20 bg-accent/10 text-accent-foreground">{p.collection || '-'}</Badge>
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
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3 h-3 text-primary" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl p-1 shadow-xl w-40">
                        <DropdownMenuItem className="text-[9px] font-black uppercase gap-2.5 p-2.5 text-green-600" onClick={() => { setAddStockProduct(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Plus className="w-3 h-3" /> Stock</DropdownMenuItem>
                        <DropdownMenuItem className="text-[9px] font-black uppercase gap-2.5 p-2.5" onClick={() => router.push(`/registry?edit=${p.id}`)}><Edit2 className="w-3.5 h-3.5" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-[9px] font-black uppercase gap-2.5 p-2.5 text-destructive" onClick={() => onDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /> Borrar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Button onClick={() => router.push('/registry')} className="h-14 w-14 rounded-full shadow-2xl flex flex-col items-center justify-center text-white active:scale-90 transition-transform" style={{ backgroundColor: brandColor }}><Plus className="w-6 h-6" /><span className="text-[7px] font-black uppercase">NUEVO</span></Button>
      </div>

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent 
          className="max-w-[95vw] md:max-w-md p-0 border-none rounded-[2rem] overflow-hidden bg-white shadow-2xl"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only"><DialogTitle>Detalle</DialogTitle></DialogHeader>
          {selectedProduct && (
            <div className="flex flex-col">
              <div className="w-full aspect-square bg-secondary relative group">
                {selectedProduct.images?.[currentImgIdx] ? (
                  <img src={getDriveThumb(selectedProduct.images[currentImgIdx], 800)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary/20"><ImageIcon className="w-12 h-12" /></div>
                )}
                
                {selectedProduct.images?.length > 1 && (
                  <>
                    <button 
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-90 transition-all"
                      onClick={() => setCurrentImgIdx(prev => (prev > 0 ? prev - 1 : selectedProduct.images.length - 1))}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button 
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-90 transition-all"
                      onClick={() => setCurrentImgIdx(prev => (prev < selectedProduct.images.length - 1 ? prev + 1 : 0))}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/20 backdrop-blur-md rounded-full text-[8px] font-black text-white">
                      {currentImgIdx + 1} / {selectedProduct.images.length}
                    </div>
                  </>
                )}

                <Button variant="ghost" size="icon" className="absolute top-4 right-4 bg-white/20 backdrop-blur-md rounded-full text-white" onClick={() => setSelectedProduct(null)}><X className="w-5 h-5" /></Button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <Badge className="bg-primary text-white text-[8px] font-black px-2">{selectedProduct.code}</Badge>
                  <h2 className="text-xl font-headline font-black text-foreground uppercase">{selectedProduct.name}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-primary/5 p-4 rounded-xl">
                  <div><p className="text-[7px] font-black text-primary/40 uppercase tracking-widest">STOCK</p><p className="text-lg font-black text-primary">{selectedProduct.stock} UND</p></div>
                  <div><p className="text-[7px] font-black text-primary/40 uppercase tracking-widest">P. UNIDAD</p><p className="text-lg font-black text-foreground">S/ {selectedProduct.priceUnidad}</p></div>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground italic leading-relaxed">"{selectedProduct.description || 'Sin descripción.'}"</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
