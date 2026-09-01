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
  AlertCircle,
  Search,
  CheckCircle2,
  Tag,
  Info
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

// VARIABLE DE MEMORIA GLOBAL PARA PERSISTIR LA SELECCIÓN DURANTE LA SESIÓN
let sessionCategoryFilter: string | null = null;

export default function InventoryList() {
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState(sessionCategoryFilter || "all")
  const [expandedCollections, setExpandedCollections] = React.useState<Record<string, boolean>>({})
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [isExporting, setIsExporting] = React.useState(false)

  const productsRef = React.useMemo(() => 
    db ? query(collection(db, "products"), orderBy("updatedAt", "desc")) : null
  , [db])
  const { data: products = [], loading: productsLoading } = useCollection(productsRef)

  const categoriesRef = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const { data: dbCategories = [] } = useCollection(categoriesRef)
  
  const masterCategories = React.useMemo(() => {
    return Array.from(new Set(dbCategories.map(c => (c.name || "").toUpperCase()))).sort();
  }, [dbCategories])

  // Sincronización de persistencia
  React.useEffect(() => {
    sessionCategoryFilter = categoryFilter;
  }, [categoryFilter])

  React.useEffect(() => {
    // Solo aplicamos el default de la config si NO hay una selección guardada en esta sesión
    if (config?.defaultCategory && !sessionCategoryFilter && categoryFilter === "all") {
      const defCat = config.defaultCategory.toUpperCase();
      setCategoryFilter(defCat);
      sessionCategoryFilter = defCat;
    }
  }, [config])

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    
    let baseList = products;
    if (categoryFilter === "RECIENTES") {
      baseList = products.slice(0, 20);
    }

    return baseList.filter(p => {
      const matchesSearch = p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || p.code?.toLowerCase().includes(q)
      
      if (categoryFilter === "RECIENTES") return matchesSearch;
      if (categoryFilter === "SIN STOCK") return matchesSearch && (Number(p.stock) <= 0);
      
      const matchesCat = categoryFilter === "all" || (p.category || "").toUpperCase() === categoryFilter.toUpperCase()
      return matchesSearch && matchesCat
    })
  }, [products, searchQuery, categoryFilter])

  const groupedByCollection = React.useMemo(() => {
    if (categoryFilter === "RECIENTES") {
      return filteredProducts.length > 0 ? [["ÚLTIMOS 20 REGISTROS", filteredProducts]] : [];
    }

    const groups: Record<string, any[]> = {}
    filteredProducts.forEach(p => {
      const col = (p.collection || "SIN COLECCIÓN").toUpperCase()
      if (!groups[col]) groups[col] = []
      groups[col].push(p)
    })
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredProducts, categoryFilter])

  const handleExport = async () => {
    if (isExporting || products.length === 0) return;
    setIsExporting(true);
    try {
      await syncCatalogToDrive(products);
      toast({ title: "CATÁLOGO EXPORTADO", description: "Sincronización con Google Sheets completa." });
    } catch (error) {
      toast({ variant: "destructive", title: "ERROR DE EXPORTACIÓN", description: "No se pudo conectar con el script de Google." });
    } finally {
      setIsExporting(false);
    }
  };

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
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-2 sticky top-0 z-40 bg-white/95 backdrop-blur-md pb-4 pt-1 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 px-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 w-full md:w-64 rounded-xl border-slate-300 font-medium text-[10px] uppercase bg-white shadow-sm tracking-widest text-slate-600">
              <SelectValue placeholder="CATEGORÍA" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 shadow-2xl">
              <SelectItem value="all" className="font-bold uppercase text-[10px]">TODAS</SelectItem>
              <SelectItem value="RECIENTES" className="font-bold uppercase text-[10px] text-blue-600">RECIENTES (20)</SelectItem>
              <SelectItem value="SIN STOCK" className="font-bold uppercase text-[10px] text-red-600">SIN STOCK</SelectItem>
              {masterCategories.map(cat => (
                <SelectItem key={cat} value={cat} className="font-bold uppercase text-[10px]">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleExport} 
            disabled={isExporting || products.length === 0} 
            className="h-10 px-4 rounded-xl border-slate-300 text-slate-500 font-bold text-[9px] uppercase gap-2 bg-white shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} EXPORTAR
          </Button>
        </div>
        <div className="relative px-2">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <Input 
            placeholder="BUSCAR CÓDIGO O MODELO..." 
            className="pl-11 h-11 rounded-xl border-slate-300 font-medium text-[11px] uppercase shadow-inner bg-slate-50/50 text-slate-700"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-6 px-1">
        {productsLoading ? (
          <div className="py-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : groupedByCollection.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center gap-4 opacity-20">
            <AlertCircle className="w-10 h-10" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Sin resultados</p>
          </div>
        ) : groupedByCollection.map(([colName, colProducts]) => {
          const isExpanded = expandedCollections[colName] || categoryFilter === "RECIENTES"
          const visibleProducts = isExpanded ? colProducts : colProducts.slice(0, 4)
          
          return (
            <div key={colName} className="space-y-3">
              <div className="flex items-center justify-between px-3 border-l-2 border-primary/40">
                <div className="flex items-center gap-3">
                  <span className="font-headline font-black text-[16px] uppercase tracking-tighter text-slate-900">{colName}</span>
                  <Badge variant="outline" className="text-[8px] font-medium border-slate-200 text-slate-400 bg-white">{colProducts.length} PRENDAS</Badge>
                </div>
                {colProducts.length > 4 && categoryFilter !== "RECIENTES" && (
                  <Button 
                    variant="ghost" 
                    className="h-7 font-bold text-[9px] uppercase text-primary hover:bg-primary/5 tracking-widest px-2"
                    onClick={() => toggleCollection(colName)}
                  >
                    {isExpanded ? "REDUCIR" : "VER TODO"} <ChevronRight className={cn("w-3 h-3 ml-1 transition-transform", isExpanded && "rotate-90")} />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-4 gap-x-2.5 px-2">
                {visibleProducts.map(p => (
                  <div key={p.id} className="group flex flex-col gap-2">
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-300 bg-white shadow-sm hover:shadow-md transition-all duration-300">
                      <img 
                        src={getDriveThumb(p.images?.[0], 600)} 
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                        onClick={() => setSelectedProduct(p)}
                        alt={p.name}
                      />
                      
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-slate-900 text-[8px] font-bold rounded-md shadow-sm border border-slate-200">
                        {p.code}
                      </div>

                      <div className={cn(
                        "absolute bottom-2 right-2 px-2 py-0.5 text-[9px] font-black rounded-md shadow-md border",
                        Number(p.stock) <= 0 ? "bg-red-600 text-white border-red-500" : "bg-white/95 text-slate-900 border-slate-200"
                      )}>
                        {p.stock} <span className="text-[7px] font-normal opacity-60">UND</span>
                      </div>

                      <div className="absolute bottom-2 left-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" className="h-8 w-8 bg-white text-slate-900 hover:bg-slate-50 rounded-lg shadow-md border border-slate-200">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="rounded-xl p-1.5 w-36 shadow-2xl border-slate-300">
                            <DropdownMenuItem className="text-[10px] font-bold uppercase gap-2.5 p-2.5 rounded-lg" onClick={() => handleEdit(p)}>
                              <Edit2 className="w-3.5 h-3.5 text-primary" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-bold uppercase gap-2.5 p-2.5 rounded-lg text-red-500" onClick={() => onDelete(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="px-1 space-y-0.5">
                      <p className="text-[10px] font-medium text-slate-800 uppercase truncate leading-tight">
                        {p.name}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
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

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 border-none bg-white rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh]">
          <div className="relative h-full flex flex-col">
            <div className="absolute top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
              <button 
                onClick={() => setSelectedProduct(null)} 
                className="pointer-events-auto h-12 w-12 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-black transition-all shadow-xl active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide pt-16 pb-8">
              <div className="space-y-8 px-6 md:px-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {selectedProduct?.images?.map((img: string, idx: number) => (
                        <div key={idx} className="aspect-[3/4] rounded-3xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                          <img src={getDriveThumb(img, 800)} className="w-full h-full object-cover" alt={`Vista ${idx + 1}`} />
                        </div>
                      ))}
                      {(!selectedProduct?.images || selectedProduct.images.length === 0) && (
                        <div className="col-span-2 aspect-[3/4] rounded-3xl bg-slate-50 flex flex-col items-center justify-center gap-4 border border-dashed border-slate-200 opacity-30">
                          <ImageIcon className="w-12 h-12" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Sin imágenes</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8 py-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary text-white text-[10px] font-black px-3 h-6 border-none">{selectedProduct?.code}</Badge>
                        <Badge variant="outline" className="text-[10px] font-bold text-slate-400 border-slate-200">{selectedProduct?.category}</Badge>
                      </div>
                      <h2 className="text-4xl font-headline font-black text-slate-900 uppercase tracking-tight leading-none">
                        {selectedProduct?.name}
                      </h2>
                      <p className="text-[11px] font-black text-primary/40 uppercase tracking-[0.3em]">{selectedProduct?.collection || "COLECCIÓN GENERAL"}</p>
                    </div>

                    <div className="bg-slate-50 rounded-[2rem] p-6 space-y-4 border border-slate-100 shadow-inner">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catálogo de Precios</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">P. POR FARDO</span>
                          <span className="text-2xl font-headline font-black text-slate-900">S/ {selectedProduct?.priceFardo?.toFixed(1) || '0.0'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10 shadow-sm">
                          <span className="text-[11px] font-bold text-primary uppercase">P. AL POR MAYOR</span>
                          <span className="text-2xl font-headline font-black text-primary">S/ {selectedProduct?.priceMayor?.toFixed(1) || '0.0'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">P. POR UNIDAD</span>
                          <span className="text-2xl font-headline font-black text-slate-900">S/ {selectedProduct?.priceUnidad?.toFixed(1) || '0.0'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción Estética</span>
                      </div>
                      <div className="bg-white border-l-4 border-primary/20 p-5 rounded-r-2xl text-[13px] text-slate-600 leading-relaxed font-medium">
                        {selectedProduct?.description || "Sin descripción detallada registrada para este modelo."}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                       <div>
                         <span className="text-[9px] font-black text-slate-400 uppercase block tracking-widest mb-1">STOCK DISPONIBLE</span>
                         <div className={cn(
                           "text-3xl font-headline font-black",
                           Number(selectedProduct?.stock) <= 0 ? "text-red-500" : "text-[#10b981]"
                         )}>
                           {selectedProduct?.stock} <span className="text-sm font-bold opacity-40">UND</span>
                         </div>
                       </div>
                       <Button 
                        className="h-14 px-8 rounded-2xl bg-[#0f172a] text-white font-bold text-[12px] uppercase shadow-lg shadow-slate-200"
                        onClick={() => handleEdit(selectedProduct)}
                       >
                         <Edit2 className="w-4 h-4 mr-2" /> Editar Prenda
                       </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
