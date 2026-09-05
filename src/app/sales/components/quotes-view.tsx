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
  User,
  Eraser,
  UserPlus,
  Tag,
  ChevronDown
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
  quantity: "",
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
  const [registeringCustomer, setRegisteringCustomer] = React.useState(false)
  const [quoteId, setQuoteId] = React.useState("B-001")
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0])
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
      if (hasUnsavedChanges && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [items, selectedCustomer, saving]);

  React.useEffect(() => {
    if (typeof window !== "undefined" && !editId) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSelectedCustomer(parsed.selectedCustomer);
          setItems(parsed.items);
          setQuoteId(parsed.quoteId);
          if (parsed.selectedDate) setSelectedDate(parsed.selectedDate);
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
        quoteId,
        selectedDate
      }));
    }
  }, [selectedCustomer, items, quoteId, isInitialized, editId, selectedDate]);

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
          if (data.date) {
            setSelectedDate(data.date)
          } else if (data.createdAt?.toDate) {
            setSelectedDate(data.createdAt.toDate().toISOString().split('T')[0]);
          }
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

  const handleQuickRegisterCustomer = async () => {
    if (!db || !customerQuery.trim()) return
    setRegisteringCustomer(true)
    try {
      const q = query(collection(db, "customers"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      let nextCustId = "CL-001"
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const lastNum = parseInt(lastId.split('-')[1]) || 0
        nextCustId = `CL-${(lastNum + 1).toString().padStart(3, '0')}`
      }
      const name = customerQuery.toUpperCase().trim()
      await setDoc(doc(db, "customers", nextCustId), { 
        id: nextCustId, 
        name, 
        phone: "", 
        location: "", 
        createdAt: serverTimestamp() 
      })
      setSelectedCustomer({ id: nextCustId, name })
      setCustomerQuery("")
      toast({ title: "CLIENTE REGISTRADO" })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL REGISTRAR" })
    } finally {
      setRegisteringCustomer(false)
    }
  }

  const selectProductForEntry = (prod: any) => {
    setCurrentEntry({
      id: Math.random().toString(),
      productId: prod.code,
      name: prod.name,
      description: "",
      quantity: "",
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
      quantity: total.toString().slice(0, 5), 
      description: desc + (currentEntry.description || ""),
      calcUnidades: calcData.unidades,
      calcSeries: calcData.series,
      calcLibres: calcData.libres
    })
    setIsCalcOpen(false)
  }

  const handleAddItemToList = () => {
    if (!currentEntry.name || !currentEntry.price || !currentEntry.quantity) {
      toast({ variant: "destructive", title: "DATOS INCOMPLETOS" });
      return;
    }
    const priceVal = Number(currentEntry.price)
    if (priceVal < 6.0) {
      if (!window.confirm("(¿Seguro quieres agregar precio menos de 6 soles?)")) return;
    }
    setItems([...items, { ...currentEntry, id: Math.random().toString() }]);
    setCurrentEntry(EMPTY_ENTRY);
  }

  const handleEditItem = (item: QuoteItem) => {
    setCurrentEntry({ ...item });
    setItems(items.filter(i => i.id !== item.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDeleteItem = (itemId: string) => {
    if (confirm("¿ELIMINAR PRENDA DE LA LISTA?")) {
      setItems(items.filter(i => i.id !== itemId));
    }
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
            updateDoc(prodRef, { stock: increment(Number(item.quantity)), updatedAt: serverTimestamp() }).catch(() => {});
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
        date: selectedDate,
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "quotes", quoteId), quoteData)

      for (const item of items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const prodRef = doc(db, "products", item.productId)
          updateDoc(prodRef, { stock: increment(-Number(item.quantity)), updatedAt: serverTimestamp() }).catch(() => {});
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

      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
      
      setSelectedCustomer(null);
      setItems([]);
      setCurrentEntry(EMPTY_ENTRY);
      setCustomerQuery("");
      setProductQuery("");

      toast({ title: editId ? "VENTA ACTUALIZADA" : "VENTA REGISTRADA" })
      router.push('/sales?tab=history')
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL GUARDAR" })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (confirm("¿DESCARTAR OPERACIÓN ACTUAL?")) {
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
      setSelectedCustomer(null);
      setItems([]);
      setQuoteId("B-001");
      setCurrentEntry(EMPTY_ENTRY);
      router.push('/sales');
    }
  }

  return (
    <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Fila Fecha y Código */}
      <div className="flex gap-2 w-full">
        <div className="flex-1">
          <input 
            type="date" 
            className="h-10 w-full bg-white border border-slate-300 rounded-xl px-4 text-[11px] font-medium text-slate-800 uppercase shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="flex-1 h-10 bg-white border border-slate-300 rounded-xl flex items-center justify-center shadow-sm">
           <span className="text-[13px] font-black text-primary uppercase tracking-tighter font-headline">{quoteId}</span>
        </div>
      </div>

      {/* Selector Cliente */}
      <div className="relative z-[40]">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input 
              placeholder="SELECCIONAR CLIENTE..." 
              className="h-12 pl-12 pr-6 bg-white border-slate-300 rounded-xl font-medium text-[11px] uppercase shadow-sm text-slate-800"
              value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery}
              onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerQuery(e.target.value); }}
            />
            {customerQuery.length >= 1 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                {customerSuggestions.map(c => (
                  <button key={c.id} className="w-full text-left px-6 py-3.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 font-medium text-[10px] uppercase transition-colors text-slate-700" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                    {c.name} <span className="text-slate-400 ml-2 font-normal">[{c.id}]</span>
                  </button>
                ))}
                {!selectedCustomer && customerQuery.length >= 1 && customerSuggestions.length === 0 && (
                  <button 
                    className="w-full text-left px-6 py-4 bg-primary/5 hover:bg-primary/10 flex items-center gap-3 border-t border-primary/10 transition-colors"
                    onClick={handleQuickRegisterCustomer}
                    disabled={registeringCustomer}
                  >
                    {registeringCustomer ? <Loader2 className="animate-spin w-4 h-4 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
                    <span className="text-[10px] font-medium uppercase text-primary">Registrar Cliente: "{customerQuery}"</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Registro Maestro ERP */}
      <Card className="rounded-2xl border border-slate-400 shadow-[0_4px_20px_rgb(0,0,0,0.03)] bg-white overflow-visible">
        <div className="bg-[#1e293b] py-2 px-6 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
               <Plus className="w-2.5 h-2.5 text-primary" />
            </div>
            <span className="text-[9px] font-black uppercase text-slate-100 tracking-[0.2em]">REGISTRO DE PRODUCTO</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white/20 hover:text-white transition-colors" onClick={() => setCurrentEntry(EMPTY_ENTRY)}>
             <Eraser className="w-3 h-3" />
          </Button>
        </div>

        <CardContent className="p-4 space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between ml-1">
               <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">NOMBRE DE PRODUCTO</Label>
               {currentEntry.productId && currentEntry.productId !== 'MANUAL' && (
                 <Badge className="bg-[#0296FF] text-white text-[8px] font-black h-4 px-2 border-none">
                    {currentEntry.productId}
                 </Badge>
               )}
            </div>
            <Input 
              value={currentEntry.name}
              onChange={e => setCurrentEntry({...currentEntry, name: e.target.value})}
              placeholder="PRODUCTO O MODELO"
              className="h-11 text-[12px] font-medium uppercase text-slate-900 bg-slate-50 border-slate-300 rounded-xl px-4 focus:ring-1 focus:ring-primary/10 shadow-inner"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-slate-400 uppercase text-center w-full block tracking-widest">CANT</Label>
              <Input 
                type="number" 
                value={currentEntry.quantity} 
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setCurrentEntry({...currentEntry, quantity: val});
                }} 
                className="h-11 text-center text-base font-black text-slate-900 bg-slate-50 border-slate-300 rounded-xl shadow-inner font-headline"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-slate-400 uppercase text-center w-full block tracking-widest">PRECIO</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={currentEntry.price} 
                  onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} 
                  className="h-11 text-center text-base font-black text-slate-900 bg-slate-50 border-slate-300 rounded-xl shadow-inner font-headline pr-8"
                />
                {currentEntry.isRegistered && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white border border-slate-300 flex items-center justify-center text-primary shadow-sm hover:bg-slate-50 transition-colors">
                        <Tag className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-xl border-slate-300 p-1.5 w-40 shadow-2xl">
                      <DropdownMenuItem className="text-[10px] font-bold uppercase p-2.5 rounded-lg flex justify-between" onClick={() => setCurrentEntry({...currentEntry, price: currentEntry.refFardo?.toString() || ""})}>
                         P. FARDO <span className="text-primary">S/ {currentEntry.refFardo?.toFixed(1)}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-[10px] font-bold uppercase p-2.5 rounded-lg flex justify-between" onClick={() => setCurrentEntry({...currentEntry, price: currentEntry.refMayor?.toString() || ""})}>
                         P. MAYOR <span className="text-primary">S/ {currentEntry.refMayor?.toFixed(1)}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-[10px] font-bold uppercase p-2.5 rounded-lg flex justify-between" onClick={() => setCurrentEntry({...currentEntry, price: currentEntry.refUnidad?.toString() || ""})}>
                         P. UNIDAD <span className="text-primary">S/ {currentEntry.refUnidad?.toFixed(1)}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-slate-400 uppercase text-center w-full block tracking-widest">DESC</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={currentEntry.discount} 
                  onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value})} 
                  className="h-11 text-center text-base font-black text-red-600 bg-red-50 border-red-200 rounded-xl shadow-inner font-headline"
                />
                <Button variant="ghost" size="icon" className="absolute -right-1.5 -top-1.5 h-7 w-7 rounded-full bg-white border border-slate-300 text-primary shadow-sm active:scale-90" onClick={() => setIsCalcOpen(true)}>
                   <Calculator className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1">
             <Label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">DESCRIPCIÓN</Label>
             <Input 
              value={currentEntry.description} 
              onChange={e => setCurrentEntry({...currentEntry, description: e.target.value})} 
              placeholder="DETALLES O NOTAS" 
              className="h-11 bg-slate-50 border-slate-300 rounded-xl px-4 text-[11px] font-medium shadow-inner text-slate-700" 
            />
          </div>

          <div className="pt-1 relative z-30">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <Input 
                placeholder="BUSCAR EN INVENTARIO..." 
                className="h-11 pl-11 pr-4 bg-slate-50 border-slate-300 rounded-xl font-medium text-[11px] uppercase shadow-inner text-slate-700"
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
              />
              {productQuery.length >= 1 && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                  {productSuggestions.map(p => (
                    <div key={p.code} className="w-full text-left px-5 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-3 transition-colors cursor-pointer group" onClick={() => selectProductForEntry(p)}>
                      <div 
                        className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0 hover:ring-2 hover:ring-primary transition-all"
                        onClick={(e) => { e.stopPropagation(); setZoomImage(p.images?.[0] || null); }}
                      >
                         {p.images?.[0] ? <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 opacity-20" />}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="font-black text-[11px] text-slate-800 uppercase truncate leading-tight group-hover:text-primary transition-colors">{p.name}</div>
                         <div className="text-[9px] font-medium text-slate-400 uppercase mt-0.5">{p.code} • STK: {p.stock}</div>
                      </div>
                      <Plus className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100" />
                    </div>
                  ))}
                  <button 
                    className="w-full text-left px-5 py-4 bg-slate-50 hover:bg-slate-100 flex items-center gap-3 border-t border-slate-100"
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
                    <span className="text-[10px] font-medium uppercase text-slate-800">ENTRADA MANUAL: "{productQuery}"</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <Button 
            className="w-full h-12 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-black text-[14px] uppercase shadow-lg active:scale-95 transition-all mt-1 tracking-widest"
            onClick={handleAddItemToList}
          >
            Añadir a la Lista
          </Button>
        </CardContent>
      </Card>

      {/* Resumen de Lista */}
      {items.length > 0 && (
        <Card className="rounded-2xl border border-slate-400 shadow-sm bg-white overflow-hidden">
          <div className="bg-slate-50 p-2.5 px-6 border-b border-slate-100 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">RESUMEN DE COTIZACIÓN</span>
            <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-200 border-none text-[9px] font-black">{items.length} PRENDAS</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <div key={item.id} className="p-3 md:px-6 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[12px] text-slate-800 uppercase truncate leading-tight">{index + 1}. {item.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded">{item.quantity} UND</span>
                    <span className="text-[9px] font-normal text-slate-300">×</span>
                    <span className="text-[10px] font-normal text-slate-500">S/ {Number(item.price).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-headline font-black text-[14px] text-slate-900 leading-none">S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-primary hover:bg-primary/5 transition-all">
                        <MoreVertical className="w-4.5 h-4.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-300 p-1.5 w-40 shadow-2xl">
                      <DropdownMenuItem className="text-[10px] font-bold uppercase gap-2.5 p-2.5 rounded-lg" onClick={() => handleEditItem(item)}>
                        <Edit2 className="w-3.5 h-3.5 text-primary" /> Editar Registro
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-[10px] font-bold uppercase gap-2.5 p-2.5 rounded-lg text-red-500" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar de Lista
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Totales y Acciones Finales */}
      <div className="bg-white rounded-2xl border border-slate-400 shadow-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TOTAL PRENDAS</span>
            <div className="text-2xl font-black text-slate-900 font-headline leading-none">
              {items.reduce((acc, i) => acc + Number(i.quantity), 0)} <span className="text-[10px] text-slate-300 uppercase ml-1">UNIDADES</span>
            </div>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">MONTO TOTAL</span>
            <div className="text-4xl font-black text-[#10b981] tracking-tighter font-headline leading-none">
              S/ {items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0).toFixed(1)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
           <Button 
            className="h-14 bg-[#1e293b] hover:bg-black text-white rounded-xl font-black text-[15px] uppercase shadow-lg active:scale-95 transition-all tracking-widest" 
            onClick={handleSaveQuote} 
            disabled={saving || items.length === 0}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5 mr-3" />} GUARDAR VENTA
          </Button>
          <Button 
            variant="outline"
            className="h-14 rounded-xl font-black text-[10px] uppercase border-slate-300 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
            onClick={handleDiscard}
          >
            DESCARTAR OPERACIÓN
          </Button>
        </div>
      </div>

      {/* Calculadora de Series */}
      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-[320px] p-8 bg-white z-[60]">
          <DialogHeader><DialogTitle className="text-[10px] font-black uppercase text-center tracking-widest text-primary mb-4">Cálculo Logístico</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[8px] font-bold uppercase text-slate-400 ml-1">UNID X SERIE</Label><Input type="number" value={calcData.unidades} onChange={e => setCalcData({...calcData, unidades: e.target.value})} className="h-12 text-center text-base font-black bg-slate-50 border-slate-300 rounded-xl font-headline" /></div>
              <div className="space-y-1"><Label className="text-[8px] font-bold uppercase text-slate-400 ml-1">N° SERIES</Label><Input type="number" value={calcData.series} onChange={e => setCalcData({...calcData, series: e.target.value})} className="h-12 text-center text-base font-black bg-slate-50 border-slate-300 rounded-xl font-headline" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[8px] font-bold uppercase text-slate-400 ml-1">+ LIBRES</Label><Input type="number" value={calcData.libres} onChange={e => setCalcData({...calcData, libres: e.target.value})} className="h-12 text-center text-base font-black bg-slate-50 border-slate-300 rounded-xl font-headline" /></div>
            <div className="bg-primary/5 p-5 rounded-2xl text-center border border-primary/10">
              <div className="text-2xl font-black text-primary font-headline">{(Number(calcData.unidades) * Number(calcData.series)) + Number(calcData.libres)} <span className="text-[12px] uppercase font-bold">UND</span></div>
            </div>
            <Button className="w-full h-12 bg-primary text-white rounded-xl font-black shadow-lg uppercase text-[11px] tracking-widest active:scale-95" onClick={handleApplyCalc}>CONFIRMAR</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom Imagen */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 border-none bg-transparent shadow-none z-[70]">
          <DialogHeader className="sr-only"><DialogTitle>Vista de Prenda</DialogTitle></DialogHeader>
          <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center bg-black/95 rounded-[2.5rem] overflow-hidden">
            <button onClick={() => setZoomImage(null)} className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"><X className="w-8 h-8" /></button>
            {zoomImage && <img src={getDriveThumb(zoomImage, 2000)} className="max-w-full max-h-full object-contain" alt="Zoom" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
