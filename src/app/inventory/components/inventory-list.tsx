
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Plus, 
  Package, 
  Trash2, 
  ImageIcon, 
  X,
  Loader2,
  PackagePlus,
  ChevronRight,
  ChevronLeft,
  Upload,
  Eye,
  Edit2,
  MoreVertical,
  AlertCircle
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
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const router = useRouter()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [expandedCollections, setExpandedCollections] = React.useState<Record<string, boolean>>({})
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [selectedImgIdx, setSelectedImgIdx] = React.useState(0)
  const [addStockProduct, setAddStockProduct] = React.useState<any>(null)
  const [addStockQty, setAddStockQty] = React.useState("")
  const [isExporting, setIsExporting] = React.useState(false)

  const productsRef = React.useMemo(() => 
    db ? query(collection(db, "products"), orderBy("updatedAt", "desc")) : null
  , [db])
  const { data: products = [], loading: productsLoading } = useCollection(productsRef)

  const categoriesRef = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const { data: dbCategories = [] } = useCollection(categoriesRef)
  
  const masterCategories = React.useMemo(() => {
    return Array.from(new Set(dbCategories.map(c => c.name.toUpperCase()))).sort();
  }, [dbCategories])

  React.useEffect(() => {
    if (config?.defaultCategory && categoryFilter === "all") {
      setCategoryFilter(config.defaultCategory.toUpperCase())
    }
  }, [config])

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => {
      const matchesSearch = p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || p.code?.toLowerCase().includes(q)
      
      if (categoryFilter === "SIN STOCK") {
        return matchesSearch && (Number(p.stock) <= 0);
      }
      
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

  const handleEdit = (p: any) => {
    router.push(`/inventory?tab=registry&edit=${p.code}`)
  }

  const toggleCollection = (col: string) => {
    setExpandedCollections(prev => ({ ...prev, [col]: !prev[col] }))
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col gap-5 sticky top-0 z-40 bg-white/95 backdrop-blur-md pb-5 pt-2 border-b border-slate-100">
        <div className="flex items-center justify-between gap-4 px-2.5">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 w-full md:w-64 rounded-2xl border-slate-200/60 font-black text-[10px] uppercase bg-white shadow-sm tracking-widest text-slate-800">
              <SelectValue placeholder="CATEGORÍA" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
              <SelectItem value="all" className="font-black uppercase text-[10px]">TODAS</SelectItem>
              <SelectItem value="SIN STOCK" className="font-black uppercase text-[10px] text-red-600">SIN STOCK</SelectItem>
              {masterCategories.map(cat => (
                <SelectItem key={cat} value={cat} className="font-black uppercase text-[10px]">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => syncCatalogToDrive(products)} disabled={isExporting} className="h-11 px-5 rounded-2xl border-slate-200/60 text-slate-600 font-black text-[9px] uppercase gap-2.5 bg-white shadow-sm hover:bg-slate-50">
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} EXPORTAR
          </Button>
        </div>
        <div className="relative px-2.5">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <Input 
            placeholder="BUSCAR CÓDIGO O MODELO..." 
            className="pl-12 h-12 rounded-2xl border-slate-100 font-bold text-[11px] uppercase shadow-inner bg-slate-50/50 text-slate-700"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-10">
        {productsLoading ? (
          <div className="py-20 text-center opacity-20"><Loader2 className="w-10 h-10 animate-spin mx-auto" /></div>
        ) : groupedByCollection.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center gap-4 opacity-20">
            <AlertCircle className="w-14 h-14" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sin resultados encontrados</p>
          </div>
        ) : groupedByCollection.map(([colName, colProducts]) => {
          const isExpanded = expandedCollections[colName]
          const visibleProducts = isExpanded ? colProducts : colProducts.slice(0, 4)
          
          return (
            <div key={colName} className="space-y-5">
              <div className="flex items-center justify-between px-3 border-l-4 border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="font-headline font-black text-[19px] uppercase tracking-tighter text-slate-900">{colName}</span>
                  <Badge variant="outline" className="text-[8px] font-black border-slate-100 text-slate-400 bg-slate-50/50">{colProducts.length} PRENDAS</Badge>
                </div>
                {colProducts.length > 4 && (
                  <Button 
                    variant="ghost" 
                    className="h-8 font-black text-[9px] uppercase text-primary hover:bg-primary/5 tracking-widest"
                    onClick={() => toggleCollection(colName)}
                  >
                    {isExpanded ? "REDUCIR" : "VER TODO"} <ChevronRight className={cn("w-3.5 h-3.5 ml-1.5 transition-transform", isExpanded && "rotate-90")} />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-8 gap-x-4 px-3">
                {visibleProducts.map(p => (
                  <div key={p.id} className="group flex flex-col gap-3">
                    <div className="relative aspect-[3/4] rounded-[1.8rem] overflow-hidden border border-slate-100 bg-slate-50 shadow-[0_4px_10px_rgb(0,0,0,0.02)] hover:shadow-2xl transition-all duration-500">
                      <img 
                        src={getDriveThumb(p.images?.[0], 600)} 
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-700 group-hover:scale-105"
                        onClick={() => setSelectedProduct(p)}
                        alt={p.name}
                      />
                      
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm text-slate-900 text-[9px] font-black rounded-lg shadow-sm border border-slate-100">
                        {p.code}
                      </div>

                      <div className={cn(
                        "absolute bottom-3 right-3 px-3 py-1 text-[10px] font-black rounded-lg shadow-lg border",
                        p.stock <= 0 ? "bg-red-600 text-white border-red-500" : "bg-white/95 text-slate-900 border-slate-100"
                      )}>
                        {p.stock} <span className="text-[8px] opacity-60">UND</span>
                      </div>

                      <div className="absolute bottom-3 left-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 transform md:translate-y-2 group-hover:translate-y-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" className="h-9 w-9 bg-white text-slate-900 hover:bg-white rounded-xl shadow-xl border border-slate-100 active:scale-90">
                              <MoreVertical className="w-4.5 h-4.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="rounded-2xl p-2 w-36 shadow-2xl border-slate-100 animate-in zoom-in-95">
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl" onClick={() => setAddStockProduct(p)}>
                              <PackagePlus className="w-4 h-4 text-primary" /> Agregar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl" onClick={() => handleEdit(p)}>
                              <Edit2 className="w-4 h-4 text-primary" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl text-red-500" onClick={() => onDelete(p.id)}>
                              <Trash2 className="w-4 h-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="px-1.5 space-y-0.5">
                      <p className="text-[11px] font-black text-slate-800 uppercase truncate leading-none tracking-tight">
                        {p.name}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {p.category}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
