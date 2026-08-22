
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
  Eye,
  LayoutGrid,
  History,
  Plus,
  PackagePlus,
  Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, serverTimestamp, updateDoc, increment, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

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
  const [addStockProduct, setAddStockProduct] = React.useState<any>(null)
  const [addStockQty, setAddStockQty] = React.useState("")
  const [currentTime, setCurrentTime] = React.useState("")

  React.useEffect(() => {
    if (addStockProduct) {
      setCurrentTime(new Date().toLocaleString('es-ES', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      }))
    }
  }, [addStockProduct])

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

  const handleInMovement = async () => {
    if (!db || !addStockProduct || !addStockQty) return
    const qty = Number(addStockQty)
    if (isNaN(qty) || qty <= 0) return

    try {
      addDoc(collection(db, "movements"), {
        productCode: addStockProduct.code,
        type: "in",
        quantity: qty,
        reason: "REPOSICIÓN DE STOCK MANUAL",
        timestamp: serverTimestamp()
      });
      
      updateDoc(doc(db, "products", addStockProduct.id), {
        stock: increment(qty),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Stock Actualizado" })
      setAddStockProduct(null)
      setAddStockQty("")
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
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
    <div className="space-y-4 pt-2 pb-32 px-2 md:px-4">
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
              <SelectValue placeholder="Categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todas</SelectItem>
              {uniqueCategories.map(cat => <SelectItem key={cat} value={cat} className="text-[9px] font-black uppercase">{cat}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="h-9 rounded-lg border-primary/10 font-black text-[9px] uppercase bg-white w-full md:w-32">
              <SelectValue placeholder="Colecciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todas</SelectItem>
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
                <TableHead className="font-black uppercase text-[9px] text-primary/60">TARIFARIO (S/)</TableHead>
                <TableHead className="font-black uppercase text-[9px] text-primary/60">ETIQUETAS</TableHead>
                <TableHead className="font-black uppercase text-[9px] text-primary/60 text-center">STOCK</TableHead>
                <TableHead className="w-14 pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Cargando...</TableCell></TableRow>
              ) : filteredProducts.map(p => (
                <TableRow key={p.id} className="hover:bg-primary/[0.01] transition-colors border-b last:border-0 h-20 group cursor-pointer" onClick={() => setSelectedProduct(p)}>
                  <TableCell className="pl-6 py-2 w-14">
                    <div className="w-12 h-12 rounded-lg border border-primary/5 overflow-hidden bg-secondary shadow-sm">
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
                    <div className="flex flex-col gap-0.5 text-[9px] font-black uppercase min-w-[140px]">
                      <div className="flex justify-between items-center gap-4 border-b border-primary/5 pb-0.5">
                        <span className="text-muted-foreground text-[7px] shrink-0">P. FARDO</span>
                        <span className="text-foreground">S/ {p.priceFardo}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 border-b border-primary/5 pb-0.5">
                        <span className="text-muted-foreground text-[7px] shrink-0">P. MAYOR</span>
                        <span className="text-foreground">S/ {p.priceMayor}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 text-primary">
                        <span className="text-[7px] shrink-0">P. UNIDAD</span>
                        <span>S/ {p.priceUnidad}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant="outline" className="text-[7px] font-black uppercase px-2 py-0 border-primary/10 bg-primary/5 text-primary whitespace-nowrap">{p.category || 'GEN'}</Badge>
                      <Badge variant="outline" className="text-[7px] font-black uppercase px-2 py-0 border-accent/20 bg-accent/10 text-accent-foreground whitespace-nowrap">{p.collection || 'GEN'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className={cn(
                      "inline-flex flex-col items-center justify-center w-10 h-10 rounded-full border shadow-sm transition-transform group-hover:scale-110",
                      p.stock <= 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200"
                    )}>
                      <span className="font-black text-[13px] leading-none">{p.stock}</span>
                      <span className="text-[6px] font-bold uppercase">UND</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6 py-2" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical className="w-4 h-4 text-primary" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl p-2 w-52 shadow-xl">
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 cursor-pointer p-3 rounded-lg" onClick={() => setSelectedProduct(p)}>
                          <Eye className="w-3.5 h-3.5 text-primary" /> Ver Detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 cursor-pointer p-3 rounded-lg bg-green-50 text-green-700" onClick={() => setAddStockProduct(p)}>
                          <PackagePlus className="w-3.5 h-3.5" /> Agregar Ingreso
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 cursor-pointer p-3 rounded-lg" onClick={() => router.push(`/registry?edit=${p.id}`)}>
                          <Edit2 className="w-3.5 h-3.5 text-primary" /> Editar Ficha
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

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Button 
          onClick={() => router.push('/registry')}
          className="h-20 w-20 rounded-full shadow-2xl flex flex-col gap-1 items-center justify-center text-white active:scale-90 transition-transform"
          style={{ backgroundColor: brandColor }}
        >
          <Plus className="w-8 h-8" />
          <span className="text-[9px] font-black uppercase">REGISTRO</span>
        </Button>
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

      <Dialog open={!!addStockProduct} onOpenChange={() => setAddStockProduct(null)}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-sm">
          <DialogHeader><DialogTitle className="text-sm font-black text-foreground uppercase tracking-widest">Registrar Ingreso de Stock</DialogTitle></DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <span className="text-[8px] font-black text-primary/40 uppercase block mb-1">Prenda Seleccionada</span>
              <span className="text-[12px] font-black uppercase text-foreground leading-tight">{addStockProduct?.name}</span>
              <span className="block text-[8px] font-black text-primary/40 mt-1">{addStockProduct?.code}</span>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Cantidad a Ingresar *</Label>
              <Input 
                type="number" 
                value={addStockQty} 
                onChange={e => setAddStockQty(e.target.value)}
                placeholder=""
                className="h-16 font-black text-center text-2xl border-green-200 bg-green-50 rounded-2xl focus:ring-green-500 shadow-inner"
              />
            </div>

            <div className="bg-secondary/30 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/40 pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-primary/40" />
                  <span className="text-[8px] font-black uppercase text-muted-foreground">Registro Temporal</span>
                </div>
                <span className="text-[10px] font-black text-foreground">{currentTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-muted-foreground">Stock Actual</span>
                  <span className="text-sm font-black text-foreground">{addStockProduct?.stock} UND</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black uppercase text-muted-foreground">Stock Final</span>
                  <div className="text-xl font-black text-green-700">{(Number(addStockProduct?.stock || 0) + Number(addStockQty || 0))} UND</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" className="h-14 rounded-2xl font-black text-[10px] uppercase border-primary/10" onClick={() => setAddStockProduct(null)}>CANCELAR</Button>
              <Button className="h-14 rounded-2xl bg-green-600 text-white font-black text-[10px] uppercase shadow-lg shadow-green-200 hover:opacity-90 active:scale-95 transition-all" onClick={handleInMovement} disabled={!addStockQty || Number(addStockQty) <= 0}>
                CONFIRMAR INGRESO
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
