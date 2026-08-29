
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, 
  Plus, 
  Search, 
  Save, 
  Loader2, 
  X,
  Calculator,
  ImageIcon,
  MoreVertical,
  Edit2,
  ShoppingCart,
  ScanLine,
  User,
  Eraser,
  Maximize2
} from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useDoc } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment, 
  getDocs, 
  limit, 
  setDoc,
  getDoc
} from "firebase/firestore"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"

interface QuoteItem {
  id: string
  productId: string
  name: string
  description: string
  quantity: string
  price: string
  stock: number
  img: string
  discount: string
  isRegistered: boolean
  calcUnidades?: string
  calcSeries?: string
  calcLibres?: string
  manualNote?: string
  refFardo?: number
  refMayor?: number
  refUnidad?: number
}

const EMPTY_ENTRY: QuoteItem = {
  id: "",
  productId: "",
  name: "",
  description: "",
  quantity: "1",
  price: "",
  stock: 0,
  img: "",
  discount: "",
  isRegistered: false,
  calcUnidades: "",
  calcSeries: "",
  calcLibres: "",
  manualNote: ""
}

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

const STORAGE_KEY = "stilo_quote_draft";

export default function QuotesView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { toast } = useToast()
  const db = useFirestore()
  
  const [saving, setSaving] = React.useState(false)
  const [quoteId, setQuoteId] = React.useState("B-001")
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<{id: string, name: string} | null>(null)
  const [productQuery, setProductQuery] = React.useState("")
  
  const [currentEntry, setCurrentEntry] = React.useState<QuoteItem>(EMPTY_ENTRY)
  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [oldItems, setOldItems] = React.useState<QuoteItem[]>([])
  const [editQuoteStatus, setEditQuoteStatus] = React.useState<string | null>(null)
  
  const [isCalcOpen, setIsCalcOpen] = React.useState(false)
  const [calcData, setCalcData] = React.useState({ unidades: "", series: "", libres: "" })
  const [zoomImage, setZoomImage] = React.useState<string | null>(null)
  const [isInitialized, setIsInitialized] = React.useState(false)

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id")) : null, [db])
  const { data: dbProducts = [] } = useCollection(productsRef)
  const { data: dbCustomers = [] } = useCollection(customersRef)

  React.useEffect(() => {
    const hasUnsavedChanges = items.length > 0 || selectedCustomer !== null;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [items, selectedCustomer]);

  React.useEffect(() => {
    if (typeof window !== "undefined" && !editId) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSelectedCustomer(parsed.selectedCustomer);
          setItems(parsed.items);
          setQuoteId(parsed.quoteId);
        } catch (e) {}
      }
    }
    setIsInitialized(true);
  }, [editId]);

  React.useEffect(() => {
    if (isInitialized && !editId && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedCustomer,
        items,
        quoteId
      }));
    }
  }, [selectedCustomer, items, quoteId, isInitialized, editId]);

  React.useEffect(() => {
    if (!db || editId) return
    const getNextId = async () => {
      const q = query(collection(db, "quotes"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const lastNum = parseInt(lastId.split('-')[1]) || 0
        setQuoteId(`B-${(lastNum + 1).toString().padStart(3, '0')}`)
      }
    }
    getNextId()
  }, [db, editId])

  React.useEffect(() => {
    if (db && editId) {
      getDoc(doc(db, "quotes", editId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          setQuoteId(data.id)
          setSelectedCustomer({ id: data.customerId, name: data.customerName })
          setItems(data.items || [])
          setOldItems(data.items || [])
          setEditQuoteStatus(data.status || 'active')
        }
      })
    }
  }, [db, editId])

  const customerSuggestions = React.useMemo(() => {
    if (customerQuery.length < 1) return []
    const q = customerQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbCustomers.filter(c => 
      c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  }, [customerQuery, dbCustomers])

  const productSuggestions = React.useMemo(() => {
    if (productQuery.length < 1) return []
    const q = productQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbProducts.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [productQuery, dbProducts])

  const selectProductForEntry = (prod: any) => {
    setCurrentEntry({
      id: Math.random().toString(),
      productId: prod.code,
      name: prod.name,
      description: "",
      quantity: "1",
      price: prod.priceMayor?.toString() || "",
      stock: prod.stock || 0,
      img: prod.images?.[0] || "",
      discount: "",
      isRegistered: true,
      calcUnidades: "",
      calcSeries: "",
      calcLibres: "",
      manualNote: "",
      refFardo: prod.priceFardo,
      refMayor: prod.priceMayor,
      refUnidad: prod.priceUnidad
    })
    setProductQuery("")
  }

  const handleApplyCalc = () => {
    const u = Number(calcData.unidades || 0)
    const s = Number(calcData.series || 0)
    const l = Number(calcData.libres || 0)
    const total = (u * s) + l
    const desc = `${u} UNID X ${s} SERIES${l > 0 ? ` + ${l}` : ''}. `
    setCurrentEntry({ 
      ...currentEntry, 
      quantity: total.toString().slice(0, 4), 
      description: desc + (currentEntry.manualNote || ""),
      calcUnidades: calcData.unidades,
      calcSeries: calcData.series,
      calcLibres: calcData.libres
    })
    setIsCalcOpen(false)
  }

  const handleSaveQuote = async () => {
    if (!db || !selectedCustomer || items.length === 0) {
      if (!selectedCustomer) toast({ variant: "destructive", title: "CLIENTE OBLIGATORIO" })
      return
    }
    setSaving(true)
    try {
      if (editId && oldItems.length > 0 && editQuoteStatus !== 'annulled') {
        for (const item of oldItems) {
          if (item.isRegistered && item.productId !== "MANUAL") {
            const prodRef = doc(db, "products", item.productId)
            updateDoc(prodRef, {
              stock: increment(Number(item.quantity)),
              updatedAt: serverTimestamp()
            }).catch(() => {});
            
            addDoc(collection(db, "movements"), {
              productCode: item.productId,
              type: "return",
              quantity: Number(item.quantity),
              reason: `REINTEGRO POR EDICIÓN BOLETA ${quoteId}`,
              timestamp: serverTimestamp(),
              referenceId: quoteId
            }).catch(() => {});
          }
        }
      }

      const total = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0)
      const subtotal = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price)), 0)
      
      const quoteData = {
        id: quoteId,
        customerName: selectedCustomer.name,
        customerId: selectedCustomer.id,
        items: items,
        subtotal: subtotal,
        total: total,
        status: 'active',
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "quotes", quoteId), quoteData)

      for (const item of items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const prodRef = doc(db, "products", item.productId)
          updateDoc(prodRef, {
            stock: increment(-Number(item.quantity)),
            updatedAt: serverTimestamp()
          }).catch(async (serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: prodRef.path,
              operation: 'update',
              requestResourceData: { stock: increment(-Number(item.quantity)) }
            }));
          });

          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: Number(item.quantity),
            reason: `SALIDA POR VENTA ${quoteId}`,
            timestamp: serverTimestamp(),
            referenceId: quoteId
          }).catch(() => {});
        }
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      toast({ title: editId ? "VENTA ACTUALIZADA" : "VENTA REGISTRADA" })
      router.push('/sales')
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL GUARDAR" })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (confirm("¿DESCARTAR COTIZACIÓN ACTUAL?")) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      setSelectedCustomer(null);
      setItems([]);
      setQuoteId("B-001");
      setCurrentEntry(EMPTY_ENTRY);
      router.push('/sales');
    }
  }

  const handleEditItem = (item: QuoteItem) => {
    setCurrentEntry({...item});
    setItems(items.filter(i => i.id !== item.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Cabecera ID y FECHA en misma fila */}
      <div className="flex gap-2 w-full">
        <div className="flex-1">
          <input 
            type="date" 
            className="h-12 w-full bg-white border border-black/10 rounded-[1.5rem] px-4 font-black text-[12px] text-[#1e293b] uppercase shadow-sm focus:outline-none"
            defaultValue={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div className="flex-1 h-12 bg-white border border-black/10 rounded-[1.5rem] flex items-center justify-center shadow-sm">
           <span className="text-[15px] font-black text-primary uppercase tracking-tighter">{quoteId}</span>
        </div>
      </div>

      {/* Tarjeta de Registro Maestro */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-[#1e293b] py-3.5 px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
               <Plus className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Registro</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-7 px-3 bg-primary text-white rounded-full text-[8px] font-black uppercase gap-2 hover:bg-primary/90">
               <Maximize2 className="w-3 h-3" /> Tools
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white" onClick={() => setCurrentEntry(EMPTY_ENTRY)}>
               <Eraser className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          {/* Nombre de Prenda */}
          <div className="space-y-1">
            <Input 
              value={currentEntry.name}
              onChange={e => setCurrentEntry({...currentEntry, name: e.target.value.toUpperCase()})}
              placeholder="PRODUCTO / CATEGORÍA"
              className="h-14 text-[14px] font-black uppercase text-[#1e293b] bg-[#f8fafc] border-black/5 rounded-2xl px-6 focus:ring-2 focus:ring-primary/20 shadow-inner"
            />
          </div>

          {/* Cantidad / Precio / Descuento */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[8px] font-black text-primary/40 uppercase ml-1 tracking-widest">Cant</Label>
              <Input 
                type="number" 
                value={currentEntry.quantity} 
                onChange={e => setCurrentEntry({...currentEntry, quantity: e.target.value.slice(0, 4)})} 
                className="h-14 text-center text-lg font-black text-[#1e293b] bg-[#f8fafc] border-black/5 rounded-2xl shadow-inner"
                placeholder="1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[8px] font-black text-primary/40 uppercase ml-1 tracking-widest">Precio</Label>
              <Input 
                type="number" 
                value={currentEntry.price} 
                onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} 
                className="h-14 text-center text-lg font-black text-[#1e293b] bg-[#f8fafc] border-black/5 rounded-2xl shadow-inner"
                placeholder="0.0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[8px] font-black text-primary/40 uppercase ml-1 tracking-widest">Desc</Label>
              <div className="relative group">
                <Input 
                  type="number" 
                  value={currentEntry.discount} 
                  onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value.slice(0, 2)})} 
                  className="h-14 text-center text-lg font-black text-orange-600 bg-orange-50/50 border-orange-100 rounded-2xl shadow-inner"
                  placeholder="0"
                />
                <Button variant="ghost" size="icon" className="absolute -right-2 -top-2 h-9 w-9 rounded-full bg-white border border-green-500/20 text-green-500 shadow-lg group-active:scale-95 transition-all" onClick={() => setIsCalcOpen(true)}>
                   <Calculator className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1 relative">
             <Input 
              value={currentEntry.description} 
              onChange={e => setCurrentEntry({...currentEntry, description: e.target.value})} 
              placeholder="DESCRIPCIÓN (MODELO, TALLAS...)" 
              className="h-14 bg-[#f8fafc] border-black/5 rounded-2xl px-6 text-[12px] font-black uppercase shadow-inner" 
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/20 font-black text-[10px] uppercase pointer-events-none">T</div>
          </div>

          {/* Buscador en Inventario */}
          <div className="pt-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/20" />
                <Input 
                  placeholder="BUSCAR EN INVENTARIO..." 
                  className="h-14 pl-14 pr-6 bg-[#f8fafc] border-black/5 rounded-2xl font-black text-[12px] uppercase shadow-inner"
                  value={productQuery}
                  onChange={e => setProductQuery(e.target.value)}
                />
                {productSuggestions.length > 0 && (
                  <div className="absolute z-[9999] w-full mt-1 bg-white border border-black/5 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {productSuggestions.map(p => (
                      <button key={p.code} className="w-full text-left px-8 py-5 hover:bg-primary/5 border-b last:border-0 flex items-center gap-4 transition-colors" onClick={() => selectProductForEntry(p)}>
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-black/5 shrink-0">
                           {p.images?.[0] ? <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-3 opacity-20" />}
                        </div>
                        <div className="flex-1">
                           <div className="font-black text-[11px] text-[#1e293b] uppercase tracking-tighter">{p.name}</div>
                           <div className="text-[9px] font-black text-primary/40 uppercase">{p.code} • STOCK: {p.stock}</div>
                        </div>
                        <Plus className="w-5 h-5 text-primary/40" />
                      </button>
                    ))}
                    <button 
                      className="w-full text-left px-8 py-6 bg-primary/5 hover:bg-primary/10 flex items-center gap-4 border-t"
                      onClick={() => {
                        setCurrentEntry({
                          ...EMPTY_ENTRY,
                          id: Math.random().toString(),
                          name: productQuery.toUpperCase(),
                          productId: "MANUAL",
                          isRegistered: false
                        });
                        setProductQuery("");
                      }}
                    >
                      <Plus className="w-5 h-5 text-primary" />
                      <span className="text-[11px] font-black uppercase text-[#1e293b]">ENTRADA MANUAL: "{productQuery}"</span>
                    </button>
                  </div>
                )}
              </div>
              <Button variant="outline" className="h-14 px-6 rounded-2xl border-black/5 bg-white shadow-md text-[#1e293b] font-black uppercase text-[10px] gap-3">
                 <ScanLine className="w-5 h-5 text-primary" /> Scan
              </Button>
            </div>
          </div>

          {/* Cuadro de Variantes (Dashed) */}
          <div className="p-6 border-2 border-dashed border-black/5 rounded-[2.5rem] bg-slate-50/50 flex items-center justify-center">
             <span className="text-[9px] font-black text-primary/20 uppercase tracking-[0.3em]">Cuadro de Variantes Libre...</span>
          </div>

          {/* Seleccion de Cliente */}
          <div className="space-y-1.5 relative">
            <div className="relative">
              <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
              <Input 
                placeholder="SELECCIONAR CLIENTE..." 
                className="h-16 pl-14 pr-12 bg-[#f8fafc] border-black/5 rounded-2xl font-black text-[13px] uppercase shadow-inner cursor-pointer"
                value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery}
                onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerQuery(e.target.value); }}
              />
              {customerSuggestions.length > 0 && (
                <div className="absolute z-[9999] w-full mt-1 bg-white border border-black/5 rounded-[2rem] shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {customerSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-8 py-5 hover:bg-primary/5 border-b last:border-0 font-black text-[11px] uppercase transition-colors" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                      {c.name} <span className="text-primary/40 ml-2">[{c.id}]</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Botón de Acción Principal */}
          <Button 
            className="w-full h-20 bg-[#10b981] hover:bg-[#059669] text-white rounded-[2rem] font-black text-lg uppercase shadow-xl shadow-green-200 active:scale-95 transition-all mt-2 tracking-widest"
            onClick={() => {
              if (!currentEntry.name || !currentEntry.price || !currentEntry.quantity) {
                toast({ variant: "destructive", title: "DATOS INCOMPLETOS" });
                return;
              }
              setItems([...items, { ...currentEntry, id: Math.random().toString() }]);
              setCurrentEntry(EMPTY_ENTRY);
            }}
          >
            Agregar al Carrito
          </Button>
        </CardContent>
      </Card>

      {/* Resumen de Lista */}
      {items.length > 0 && (
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <div className="bg-slate-100/50 p-5 px-10 border-b border-black/5 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-[#1e293b] tracking-[0.2em]">Resumen de Lista</span>
            <span className="text-[9px] font-black text-primary/40 uppercase">{items.length} Prendas</span>
          </div>
          <div className="divide-y divide-black/5">
            {items.map((item, index) => (
              <div key={item.id} className="p-5 md:px-10 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-[13px] text-[#1e293b] uppercase truncate">{index + 1}. {item.name}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[9px] font-black uppercase px-2">{item.quantity} UND</Badge>
                    <span className="text-[10px] font-bold text-slate-400">×</span>
                    <span className="text-[10px] font-black text-slate-600 uppercase">S/ {Number(item.price).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-black text-base text-[#1e293b] leading-none">S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-primary transition-colors"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl p-2 w-40 shadow-2xl border-black/5">
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl" onClick={() => handleEditItem(item)}><Edit2 className="w-4 h-4 text-primary" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl text-red-500" onClick={() => handleDeleteItem(item.id)}><Trash2 className="w-4 h-4" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Totales Finales */}
      <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl p-8 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Prendas</span>
            <div className="text-3xl font-black text-[#1e293b]">{items.reduce((acc, i) => acc + Number(i.quantity), 0)} <span className="text-xs opacity-20">UND</span></div>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Total</span>
            <div className="text-4xl font-black text-[#10b981] tracking-tighter">S/ {items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0).toFixed(1)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
           <Button 
            className="h-16 bg-[#1e293b] hover:bg-black text-white rounded-[2rem] font-black text-lg uppercase shadow-xl active:scale-95 transition-all tracking-widest" 
            onClick={handleSaveQuote} 
            disabled={saving || items.length === 0}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5 mr-3" />} Guardar Venta
          </Button>
          <Button 
            variant="outline"
            className="h-16 rounded-[2rem] font-black text-[11px] uppercase border-black/5 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all active:scale-95"
            onClick={handleDiscard}
          >
            Descartar Cotización
          </Button>
        </div>
      </div>

      {/* Diálogos (Calculadora / Zoom) */}
      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl max-w-[340px] p-10 bg-white">
          <DialogHeader><DialogTitle className="text-[10px] font-black uppercase text-center tracking-[0.3em] text-primary mb-4">Cálculo de Series</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Unid x Serie</Label><Input type="number" value={calcData.unidades} onChange={e => setCalcData({...calcData, unidades: e.target.value})} className="h-14 text-center text-lg font-black bg-slate-50 border-none rounded-2xl shadow-inner" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">N° Series</Label><Input type="number" value={calcData.series} onChange={e => setCalcData({...calcData, series: e.target.value})} className="h-14 text-center text-lg font-black bg-slate-50 border-none rounded-2xl shadow-inner" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">+ Unid Libres</Label><Input type="number" value={calcData.libres} onChange={e => setCalcData({...calcData, libres: e.target.value})} className="h-14 text-center text-lg font-black bg-slate-50 border-none rounded-2xl shadow-inner" /></div>
            <div className="bg-primary/5 p-6 rounded-3xl text-center border border-primary/10">
              <div className="text-3xl font-black text-primary">{(Number(calcData.unidades) * Number(calcData.series)) + Number(calcData.libres)} <span className="text-xs">UND</span></div>
            </div>
            <Button className="w-full h-16 bg-primary text-white rounded-2xl font-black shadow-lg" onClick={handleApplyCalc}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 border-none bg-transparent shadow-none">
          <DialogHeader className="sr-only"><DialogTitle>Vista de Prenda</DialogTitle></DialogHeader>
          <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center bg-black/95 rounded-[3rem] overflow-hidden">
            <button onClick={() => setZoomImage(null)} className="absolute top-8 right-8 z-50 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"><X className="w-8 h-8" /></button>
            {zoomImage && <img src={getDriveThumb(zoomImage, 2000)} className="max-w-full max-h-full object-contain" alt="Zoom" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
