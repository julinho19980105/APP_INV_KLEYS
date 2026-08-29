
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
import { useFirestore, useCollection } from "@/firebase"
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
    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Fila Fecha y Código */}
      <div className="flex gap-2.5 w-full">
        <div className="flex-1">
          <input 
            type="date" 
            className="h-11 w-full bg-white border border-slate-200/60 rounded-2xl px-5 text-[11px] font-bold text-slate-800 uppercase shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
            defaultValue={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div className="flex-1 h-11 bg-white border border-slate-200/60 rounded-2xl flex items-center justify-center shadow-sm">
           <span className="text-[13px] font-black text-primary uppercase tracking-tighter font-headline">{quoteId}</span>
        </div>
      </div>

      {/* Registro Maestro ERP */}
      <Card className="rounded-[2.5rem] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white overflow-hidden">
        <div className="bg-[#1e293b] py-3 px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
               <Plus className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[9px] font-bold uppercase text-slate-100 tracking-[0.2em] opacity-90">REGISTRO INDUSTRIAL</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" className="h-7 px-3 bg-primary text-white rounded-full text-[8px] font-bold uppercase gap-2 hover:bg-primary/90 transition-transform active:scale-95">
               <Maximize2 className="w-3 h-3" /> TOOLS
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/20 hover:text-white transition-colors" onClick={() => setCurrentEntry(EMPTY_ENTRY)}>
               <Eraser className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">NOMBRE DE PRODUCTO</Label>
            <Input 
              value={currentEntry.name}
              onChange={e => setCurrentEntry({...currentEntry, name: e.target.value.toUpperCase()})}
              placeholder="EJ: PRENDA FASHION 2024"
              className="h-14 text-[13px] font-black uppercase text-slate-900 bg-slate-50/50 border-slate-100 rounded-2xl px-6 focus:ring-2 focus:ring-primary/10 shadow-inner placeholder:text-slate-300"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-bold text-slate-400 uppercase text-center w-full block tracking-widest">CANT</Label>
              <Input 
                type="number" 
                value={currentEntry.quantity} 
                onChange={e => setCurrentEntry({...currentEntry, quantity: e.target.value.slice(0, 4)})} 
                className="h-14 text-center text-lg font-black text-slate-900 bg-slate-50/50 border-slate-100 rounded-2xl shadow-inner font-headline"
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-bold text-slate-400 uppercase text-center w-full block tracking-widest">PRECIO</Label>
              <Input 
                type="number" 
                value={currentEntry.price} 
                onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} 
                className="h-14 text-center text-lg font-black text-slate-900 bg-slate-50/50 border-slate-100 rounded-2xl shadow-inner font-headline"
                placeholder="0.0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-bold text-slate-400 uppercase text-center w-full block tracking-widest">DESC</Label>
              <div className="relative group">
                <Input 
                  type="number" 
                  value={currentEntry.discount} 
                  onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value.slice(0, 2)})} 
                  className="h-14 text-center text-lg font-black text-orange-600 bg-orange-50/40 border-orange-100/60 rounded-2xl shadow-inner font-headline"
                  placeholder="0"
                />
                <Button variant="ghost" size="icon" className="absolute -right-1.5 -top-1.5 h-8 w-8 rounded-full bg-white border border-slate-100 text-primary shadow-sm hover:shadow-md transition-all active:scale-90" onClick={() => setIsCalcOpen(true)}>
                   <Calculator className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1 relative">
             <Label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">DESCRIPCIÓN OPERATIVA</Label>
             <Input 
              value={currentEntry.description} 
              onChange={e => setCurrentEntry({...currentEntry, description: e.target.value})} 
              placeholder="MODELO, TALLAS, COLORES..." 
              className="h-14 bg-slate-50/50 border-slate-100 rounded-2xl px-6 text-[11px] font-bold uppercase shadow-inner text-slate-700" 
            />
          </div>

          <div className="pt-1.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input 
                  placeholder="BÚSQUEDA EN INVENTARIO..." 
                  className="h-14 pl-14 pr-6 bg-slate-50/50 border-slate-100 rounded-2xl font-bold text-[11px] uppercase shadow-inner text-slate-700"
                  value={productQuery}
                  onChange={e => setProductQuery(e.target.value)}
                />
                {productSuggestions.length > 0 && (
                  <div className="absolute z-[9999] w-full mt-2 bg-white border border-slate-100 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {productSuggestions.map(p => (
                      <button key={p.code} className="w-full text-left px-7 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center gap-4 transition-colors" onClick={() => selectProductForEntry(p)}>
                        <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
                           {p.images?.[0] ? <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2.5 opacity-20" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="font-black text-[11px] text-slate-800 uppercase truncate leading-tight">{p.name}</div>
                           <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{p.code} • STK: {p.stock}</div>
                        </div>
                        <Plus className="w-4 h-4 text-primary opacity-40" />
                      </button>
                    ))}
                    <button 
                      className="w-full text-left px-7 py-5 bg-slate-50/50 hover:bg-slate-100 flex items-center gap-4 border-t border-slate-100"
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
                      <Plus className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-black uppercase text-slate-800">ENTRADA MANUAL: "{productQuery}"</span>
                    </button>
                  </div>
                )}
              </div>
              <Button variant="outline" className="h-14 px-6 rounded-2xl border-slate-200/60 bg-white shadow-sm text-slate-600 font-bold uppercase text-[9px] gap-2.5 hover:bg-slate-50 active:scale-95 transition-all">
                 <ScanLine className="w-4 h-4 text-primary" /> SCAN
              </Button>
            </div>
          </div>

          <div className="p-5 border border-dashed border-slate-200 rounded-[2rem] bg-slate-50/30 flex items-center justify-center">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">NOTAS ADICIONALES DE PRENDA</span>
          </div>

          <div className="space-y-1 relative">
            <div className="relative">
              <User className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input 
                placeholder="SELECCIONAR CLIENTE PENDIENTE..." 
                className="h-16 pl-14 pr-12 bg-slate-50/50 border-slate-100 rounded-2xl font-black text-[12px] uppercase shadow-inner text-slate-800 cursor-pointer"
                value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery}
                onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerQuery(e.target.value); }}
              />
              {customerSuggestions.length > 0 && (
                <div className="absolute z-[9999] w-full mt-2 bg-white border border-slate-100 rounded-[2rem] shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {customerSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-8 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 font-bold text-[11px] uppercase transition-colors text-slate-700" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                      {c.name} <span className="text-slate-400 ml-2 font-medium">[{c.id}]</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button 
            className="w-full h-16 bg-[#10b981] hover:bg-[#059669] text-white rounded-[2rem] font-black text-base uppercase shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)] active:scale-95 transition-all mt-1 tracking-[0.1em]"
            onClick={() => {
              if (!currentEntry.name || !currentEntry.price || !currentEntry.quantity) {
                toast({ variant: "destructive", title: "DATOS INCOMPLETOS" });
                return;
              }
              setItems([...items, { ...currentEntry, id: Math.random().toString() }]);
              setCurrentEntry(EMPTY_ENTRY);
            }}
          >
            Añadir a la Lista
          </Button>
        </CardContent>
      </Card>

      {/* Resumen de Lista */}
      {items.length > 0 && (
        <Card className="rounded-[2.5rem] border-none shadow-[0_8px_30px_rgb(0,0,0,0.03)] bg-white overflow-hidden">
          <div className="bg-slate-50/80 p-4 px-10 border-b border-slate-100 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">RESUMEN DE OPERACIÓN</span>
            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-none text-[8px] font-black">{items.length} LÍNEAS</Badge>
          </div>
          <div className="divide-y divide-slate-50">
            {items.map((item, index) => (
              <div key={item.id} className="p-4 md:px-10 flex justify-between items-center group hover:bg-slate-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-[12px] text-slate-800 uppercase truncate leading-tight">{index + 1}. {item.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-md">{item.quantity} UND</span>
                    <span className="text-[9px] font-bold text-slate-300">×</span>
                    <span className="text-[10px] font-bold text-slate-500">S/ {Number(item.price).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="font-black text-[15px] text-slate-900 leading-none font-headline">S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:text-primary transition-colors"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl p-2 w-40 shadow-2xl border-slate-100">
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl" onClick={() => handleEditItem(item)}><Edit2 className="w-3.5 h-3.5 text-primary" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl text-red-500" onClick={() => handleDeleteItem(item.id)}><Trash2 className="w-3.5 h-3.5" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Totales y Acciones Finales */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_15px_40px_rgb(0,0,0,0.06)] p-7 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">TOTAL PRENDAS</span>
            <div className="text-2xl font-black text-slate-900 font-headline leading-none">
              {items.reduce((acc, i) => acc + Number(i.quantity), 0)} <span className="text-[10px] text-slate-200 uppercase ml-1">UNIDADES</span>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">MONTO TOTAL</span>
            <div className="text-4xl font-black text-[#10b981] tracking-tighter font-headline leading-none">
              S/ {items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0).toFixed(1)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
           <Button 
            className="h-16 bg-[#1e293b] hover:bg-black text-white rounded-[2rem] font-black text-base uppercase shadow-[0_15px_30px_-5px_rgba(30,41,59,0.3)] active:scale-95 transition-all tracking-[0.1em]" 
            onClick={handleSaveQuote} 
            disabled={saving || items.length === 0}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5 mr-3" />} GUARDAR VENTA
          </Button>
          <Button 
            variant="outline"
            className="h-16 rounded-[2rem] font-black text-[10px] uppercase border-slate-100 text-slate-400 hover:bg-red-50/50 hover:text-red-500 transition-all active:scale-95"
            onClick={handleDiscard}
          >
            DESCARTAR OPERACIÓN
          </Button>
        </div>
      </div>

      {/* Calculadora de Series */}
      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl max-w-[340px] p-10 bg-white">
          <DialogHeader><DialogTitle className="text-[10px] font-black uppercase text-center tracking-[0.3em] text-primary mb-6">Cálculo Logístico</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[8px] font-bold uppercase text-slate-400 ml-1">UNID X SERIE</Label><Input type="number" value={calcData.unidades} onChange={e => setCalcData({...calcData, unidades: e.target.value})} className="h-14 text-center text-lg font-black bg-slate-50 border-none rounded-2xl shadow-inner font-headline" /></div>
              <div className="space-y-1.5"><Label className="text-[8px] font-bold uppercase text-slate-400 ml-1">N° SERIES</Label><Input type="number" value={calcData.series} onChange={e => setCalcData({...calcData, series: e.target.value})} className="h-14 text-center text-lg font-black bg-slate-50 border-none rounded-2xl shadow-inner font-headline" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-[8px] font-bold uppercase text-slate-400 ml-1">+ LIBRES</Label><Input type="number" value={calcData.libres} onChange={e => setCalcData({...calcData, libres: e.target.value})} className="h-14 text-center text-lg font-black bg-slate-50 border-none rounded-2xl shadow-inner font-headline" /></div>
            <div className="bg-primary/5 p-7 rounded-3xl text-center border border-primary/10">
              <div className="text-3xl font-black text-primary font-headline">{(Number(calcData.unidades) * Number(calcData.series)) + Number(calcData.libres)} <span className="text-xs uppercase font-bold">UND</span></div>
            </div>
            <Button className="w-full h-14 bg-primary text-white rounded-2xl font-black shadow-lg uppercase text-[11px] tracking-widest active:scale-95" onClick={handleApplyCalc}>CONFIRMAR CÁLCULO</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visor de Imágenes */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 border-none bg-transparent shadow-none">
          <DialogHeader className="sr-only"><DialogTitle>Visor Nítido</DialogTitle></DialogHeader>
          <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center bg-black/98 rounded-[3rem] overflow-hidden">
            <button onClick={() => setZoomImage(null)} className="absolute top-8 right-8 z-50 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"><X className="w-8 h-8" /></button>
            {zoomImage && <img src={getDriveThumb(zoomImage, 2000)} className="max-w-full max-h-full object-contain" alt="Zoom" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
