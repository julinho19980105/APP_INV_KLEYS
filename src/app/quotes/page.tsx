
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
  PackageSearch,
  X,
  Calculator,
  ImageIcon,
  UserPlus,
  ArrowLeft,
  RotateCcw
} from "lucide-react"
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

export default function QuotesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { toast } = useToast()
  const db = useFirestore()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

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
  const [registeringCustomer, setRegisteringCustomer] = React.useState(false)
  const [isInitialized, setIsInitialized] = React.useState(false)

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id")) : null, [db])
  const { data: dbProducts = [] } = useCollection(productsRef)
  const { data: dbCustomers = [] } = useCollection(customersRef)

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
    if (productQuery.length < 2) return []
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
      toast({ title: "Cliente Registrado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
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
      manualNote: ""
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
      quantity: total.toString(), 
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
      // LOGICA DE REINTEGRO: Solo si la boleta estaba ACTIVA o ENVIADA (no anulada)
      // Si estaba ANULADA, el stock ya está en el inventario, no reintegramos nada.
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
        status: 'active', // Al guardar una edición de anulada, vuelve a estar activa
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "quotes", quoteId), quoteData)

      // LOGICA DE SALIDA: Descontamos los nuevos items
      for (const item of items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const prodRef = doc(db, "products", item.productId)
          updateDoc(prodRef, {
            stock: increment(-Number(item.quantity)),
            updatedAt: serverTimestamp()
          }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: prodRef.path, operation: 'update' }));
          });

          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: Number(item.quantity),
            reason: `SALIDA POR VENTA ${quoteId}`,
            timestamp: serverTimestamp(),
            referenceId: quoteId
          }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'movements', operation: 'create' }));
          });
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
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSelectedCustomer(null);
    setItems([]);
    setQuoteId("B-001");
    router.push('/sales');
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 pt-2 px-2 md:px-0">
      <div className="flex justify-between items-center border-b-2 border-primary/20 pb-4">
        <div className="flex items-center gap-3">
           <Button variant="ghost" size="icon" onClick={() => router.push('/sales')} className="h-9 w-9 rounded-xl hover:bg-primary/5">
            <ArrowLeft className="w-5 h-5 text-primary" />
          </Button>
          <h1 className="text-xl md:text-2xl font-headline font-black text-foreground uppercase tracking-tight">COTIZACIÓN</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xl md:text-2xl font-headline font-black text-primary uppercase">{quoteId}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-[9px] uppercase text-foreground font-black ml-1">CLIENTE</Label>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Input 
                placeholder="" 
                className="h-11 text-xs font-black uppercase rounded-xl border-primary/10 bg-white shadow-sm"
                value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery}
                onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerQuery(e.target.value); }}
              />
              {customerSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-primary/10 rounded-xl shadow-2xl overflow-hidden">
                  {customerSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-primary/5 border-b last:border-0" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                      <span className="text-[10px] font-black uppercase text-foreground">{c.name} <span className="ml-1 text-primary">[{c.id}]</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!selectedCustomer && customerQuery.length >= 1 && customerSuggestions.length === 0 && (
              <Button 
                className="h-11 w-11 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 shrink-0"
                onClick={handleQuickRegisterCustomer}
                disabled={registeringCustomer}
              >
                {registeringCustomer ? <Loader2 className="animate-spin w-4 h-4" /> : <UserPlus className="w-5 h-5" />}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-black text-foreground ml-1">BUSCAR PRENDA</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-primary" />
            <Input 
              placeholder="" 
              className="pl-9 h-11 rounded-xl border-primary/10 font-black text-xs uppercase bg-white shadow-sm" 
              value={productQuery} 
              onChange={e => setProductQuery(e.target.value)} 
            />
            {productQuery.length >= 2 && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-primary/10 rounded-2xl shadow-2xl overflow-hidden">
                {productSuggestions.map(p => (
                  <div key={p.code} className="w-full text-left px-4 py-3 hover:bg-primary/5 flex items-center gap-3 border-b last:border-0 group">
                    <div 
                      className="w-10 h-10 rounded-lg border border-primary/10 overflow-hidden bg-secondary cursor-pointer shrink-0 hover:ring-2 transition-all"
                      onClick={(e) => { e.stopPropagation(); setZoomImage(p.images?.[0] || null); }}
                      style={{ borderColor: brandColor }}
                    >
                      {p.images?.[0] ? <img src={getDriveThumb(p.images[0], 400)} className="w-full h-full object-cover" alt="min" /> : <ImageIcon className="w-full h-full p-2 opacity-20" />}
                    </div>
                    <button className="flex-1 min-w-0 text-left" onClick={() => selectProductForEntry(p)}>
                      <div className="font-black text-[10px] text-foreground uppercase group-hover:text-primary transition-colors">{p.name}</div>
                      <div className="text-[7px] font-black text-muted-foreground uppercase">{p.code}</div>
                    </button>
                  </div>
                ))}
                <button 
                  className="w-full text-left px-4 py-4 hover:bg-primary/5 bg-primary/5 border-t flex items-center gap-3"
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
                  <span className="text-[10px] font-black uppercase text-foreground">Manual: "{productQuery}"</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {currentEntry.name && (
        <Card className="rounded-[2rem] border-2 border-primary/10 bg-white overflow-hidden shadow-xl shadow-primary/5">
          <div className="bg-primary/5 border-b border-primary/10 py-3 px-8 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[14px] font-black uppercase text-foreground">{currentEntry.name}</span>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{currentEntry.productId}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-black text-[10px] px-3 bg-green-50 text-green-600 border-green-200">
                DISPONIBLE: {currentEntry.stock}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setCurrentEntry(EMPTY_ENTRY)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardContent className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div 
                className="w-20 h-20 rounded-2xl overflow-hidden border border-primary/10 shrink-0 bg-muted flex items-center justify-center cursor-pointer hover:ring-2 transition-all shadow-md"
                onClick={() => setZoomImage(currentEntry.img)}
              >
                {currentEntry.img ? <img src={getDriveThumb(currentEntry.img, 400)} className="w-full h-full object-cover" /> : <PackageSearch className="w-8 h-8 opacity-20" />}
              </div>
              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-muted-foreground ml-1">PRECIO</Label>
                    <Input type="number" className="h-10 text-xs font-black rounded-xl border-primary/10 focus:ring-primary" value={currentEntry.price} onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} placeholder="" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:col-span-2">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground ml-1">CANTIDAD</Label>
                      <div className="flex gap-1">
                        <Input type="number" className="h-10 text-xs font-black rounded-xl border-primary/20 focus:ring-primary" value={currentEntry.quantity} onChange={e => setCurrentEntry({...currentEntry, quantity: e.target.value})} placeholder="" />
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl border-primary/10 text-primary" onClick={() => {
                          setCalcData({ unidades: currentEntry.calcUnidades || "", series: currentEntry.calcSeries || "", libres: currentEntry.calcLibres || "" });
                          setIsCalcOpen(true);
                        }}>
                          <Calculator className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground ml-1">DSCTO</Label>
                      <Input type="number" className="h-10 text-xs font-black border-orange-200 bg-orange-50 text-orange-600 rounded-xl" value={currentEntry.discount} onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value})} placeholder="" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-muted-foreground ml-1">DESCRIPCIÓN / NOTAS</Label>
                  <Input className="h-10 text-[10px] font-normal uppercase bg-secondary/50 border-none rounded-xl" value={currentEntry.description} onChange={e => setCurrentEntry({...currentEntry, description: e.target.value})} placeholder="" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 rounded-2xl font-black text-xs uppercase border-primary/10 text-muted-foreground" onClick={() => setCurrentEntry(EMPTY_ENTRY)}>
                <Trash2 className="w-4 h-4 mr-2" /> LIMPIAR
              </Button>
              <Button className="h-12 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-primary/20" onClick={() => {
                if (!currentEntry.name || !currentEntry.price || !currentEntry.quantity) return
                setItems([...items, { ...currentEntry }])
                setCurrentEntry(EMPTY_ENTRY)
              }}>
                <Plus className="w-4 h-4 mr-2" /> AGREGAR A LISTA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[2rem] border border-primary/10 shadow-sm bg-white overflow-hidden">
        <div className="bg-primary/5 border-b border-primary/10 py-3 px-6 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase text-primary tracking-widest">LISTA DE PRODUCTOS</span>
          {items.length > 0 && (
             <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => setItems([])}>
              <RotateCcw className="w-3 h-3" /> Limpiar Lista
            </Button>
          )}
        </div>
        <div className="divide-y divide-primary/5">
          {items.length === 0 ? (
            <div className="p-12 text-center opacity-20 font-black uppercase text-xs">Sin prendas en la lista</div>
          ) : items.map((item) => (
            <div key={item.id} className="p-4 md:px-8 hover:bg-primary/[0.01] transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[12px] text-foreground uppercase">{item.name}</span>
                  <Badge variant="outline" className="text-[7px] font-black py-0 px-2 uppercase border-primary/10 text-primary">{item.productId}</Badge>
                </div>
                <div className="font-headline font-black text-sm text-foreground">
                  S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(2)}
                </div>
              </div>
              <div className="flex justify-between items-end mt-1">
                <div className="text-[9px] font-normal uppercase text-muted-foreground leading-relaxed">
                  <div className="font-black text-foreground/70 mb-0.5">{item.description || "Sin descripción"}</div>
                  <div className="flex gap-2 items-center">
                    <span className="font-black text-primary">{item.quantity} UND</span>
                    <span className="opacity-30">×</span>
                    <span>S/ {item.price}</span>
                    {Number(item.discount) > 0 && (
                      <><span className="opacity-30">|</span><span className="text-destructive font-black">DESC. - S/ {item.discount}</span></>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setItems(items.filter(i => i.id !== item.id))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col md:flex-row justify-between items-end border-b-4 border-primary pb-6 pt-6 gap-6">
        <div className="w-full md:w-auto space-y-1">
          <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">CANTIDAD TOTAL</div>
          <div className="font-headline font-black text-3xl md:text-4xl text-foreground">{items.reduce((acc, i) => acc + Number(i.quantity), 0)} <span className="text-sm">UND</span></div>
        </div>
        <div className="w-full md:w-auto text-left md:text-right space-y-4">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">MONTO TOTAL NETO</div>
            <div className="font-headline font-black text-4xl md:text-6xl text-foreground tracking-tighter">S/ {items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0).toFixed(2)}</div>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-64">
             <Button 
              className="h-16 w-full bg-primary text-white rounded-2xl font-black text-base uppercase shadow-2xl shadow-primary/30 active:scale-95 transition-all" 
              onClick={handleSaveQuote} 
              disabled={saving || items.length === 0}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5 mr-3" />} GUARDAR VENTA
            </Button>
            <Button 
              variant="outline"
              className="h-12 w-full rounded-xl font-black text-xs uppercase border-primary/10 text-muted-foreground hover:bg-primary/5"
              onClick={handleDiscard}
            >
              DESCARTAR EDICIÓN
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-xs">
          <DialogHeader><DialogTitle className="text-xs font-black text-foreground uppercase tracking-widest">Calculadora de Series</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Unid x Serie</Label><Input type="number" value={calcData.unidades} onChange={e => setCalcData({...calcData, unidades: e.target.value})} className="h-10 text-xs font-black text-center border-primary/10 rounded-xl" placeholder="" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">N° Series</Label><Input type="number" value={calcData.series} onChange={e => setCalcData({...calcData, series: e.target.value})} className="h-10 text-xs font-black text-center border-primary/10 rounded-xl" placeholder="" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">+ Unid Libres</Label><Input type="number" value={calcData.libres} onChange={e => setCalcData({...calcData, libres: e.target.value})} className="h-10 text-xs font-black text-center border-primary/10 rounded-xl" placeholder="" /></div>
            <div className="bg-primary/5 p-4 rounded-xl text-center border border-primary/10">
              <div className="text-[8px] font-black uppercase text-primary/40 mb-1">Total Calculado</div>
              <div className="text-2xl font-black text-primary">{(Number(calcData.unidades) * Number(calcData.series)) + Number(calcData.libres)} UND</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl font-black text-[9px] uppercase border-primary/10" onClick={() => setIsCalcOpen(false)}>CANCELAR</Button>
              <Button className="bg-primary text-white rounded-xl font-black text-[9px] uppercase shadow-lg shadow-primary/20" onClick={handleApplyCalc}>CONFIRMAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[90vw] md:max-w-4xl p-0 border-none bg-transparent shadow-none">
          <DialogHeader className="sr-only"><DialogTitle>Vista de Prenda</DialogTitle></DialogHeader>
          <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center bg-black/90 rounded-[2rem] overflow-hidden">
            <button onClick={() => setZoomImage(null)} className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"><X className="w-6 h-6" /></button>
            {zoomImage && <img src={getDriveThumb(zoomImage, 2000)} className="max-w-full max-h-full object-contain" alt="Zoom" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
